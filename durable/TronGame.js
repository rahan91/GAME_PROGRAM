const DIR_MAP = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export class TronGame {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = [];
    this.room = {};
    this.connections = new Map();
    this.gameLoop = null;
    this.started = false;
    this.initialized = false;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      if (!this.initialized) await this.initFromDB(request);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.handleConnection(server, request);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not a websocket', { status: 400 });
  }

  async initFromDB(request) {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');
    if (!roomId) return;

    const db = this.env.DATABASE;
    const roomRow = await db.prepare('SELECT id, code, status, host_id, max_players, speed, grid_w, grid_h FROM tron_rooms WHERE id = ?').bind(roomId).first();
    if (!roomRow) return;

    this.room = {
      id: roomRow.id,
      code: roomRow.code,
      status: roomRow.status || 'waiting',
      hostId: roomRow.host_id,
      maxPlayers: roomRow.max_players || 8,
      speed: roomRow.speed || 'medium',
      gridW: roomRow.grid_w || 640,
      gridH: roomRow.grid_h || 480,
    };

    const playerRows = await db.prepare('SELECT id, user_id, username, x, y, dir, alive, ready, color, trail FROM tron_players WHERE room_id = ? ORDER BY joined_at ASC').bind(roomId).all();
    this.players = (playerRows.results || []).map(p => ({
      id: p.id,
      userId: String(p.user_id),
      username: p.username,
      color: p.color || 'rgba(0,229,255,0.85)',
      x: p.x || 0,
      y: p.y || 0,
      dir: p.dir || '',
      alive: p.alive ? 1 : 0,
      ready: p.ready ? 1 : 0,
      trail: p.trail ? JSON.parse(p.trail) : [],
    }));

    if (this.room.status === 'playing') {
      this.startGameLoop();
    }

    this.initialized = true;
  }

  async handleConnection(ws, request) {
    ws.accept();

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const username = url.searchParams.get('username');
    const color = url.searchParams.get('color') || 'rgba(0,229,255,0.85)';

    if (!userId || !username) {
      ws.send(JSON.stringify({ type: 'error', error: 'Missing auth' }));
      ws.close(4000, 'Missing auth');
      return;
    }

    const playerIdx = this.players.findIndex(p => String(p.userId) === String(userId));

    if (playerIdx >= 0) {
      this.connections.set(userId, ws);
      ws.send(JSON.stringify({ type: 'welcome', playerIndex: playerIdx, room: this.room }));
      this.broadcastState();
      return;
    }

    if (this.room.status !== 'waiting') {
      ws.send(JSON.stringify({ type: 'error', error: 'Game already in progress' }));
      ws.close(4003, 'Game in progress');
      return;
    }

    if (this.players.length >= (this.room.maxPlayers || 8)) {
      ws.send(JSON.stringify({ type: 'error', error: 'Room full' }));
      ws.close(4004, 'Room full');
      return;
    }

    const GRID_W = this.room.gridW || 640;
    const GRID_H = this.room.gridH || 480;
    const pos = this.getStartPos(this.players.length, GRID_W, GRID_H);

    const player = {
      id: crypto.randomUUID(),
      userId: String(userId),
      username,
      color,
      x: pos.x,
      y: pos.y,
      dir: pos.dir,
      alive: 1,
      ready: 0,
      trail: [],
    };

    this.players.push(player);
    this.connections.set(String(userId), ws);

    const playerIndex = this.players.length - 1;
    ws.send(JSON.stringify({ type: 'welcome', playerIndex, room: this.room }));
    this.broadcastLobby();
  }

  getStartPos(index, gw, gh) {
    const n = index + 1;
    const perimeter = 2 * (gw + gh);
    const offset = (n * perimeter) / 16;

    if (offset < gw) return { x: Math.round(offset), y: 1, dir: 'down' };
    if (offset < gw + gh) return { x: gw - 2, y: Math.round(offset - gw), dir: 'left' };
    if (offset < 2 * gw + gh) return { x: Math.round(2 * gw + gh - offset), y: gh - 2, dir: 'up' };
    return { x: 1, y: Math.round(perimeter - offset), dir: 'right' };
  }

  async handleMessage(userId, message) {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'input': {
          const p = this.players.find(pl => String(pl.userId) === String(userId));
          if (p && p.alive) {
            const dir = String(msg.dir).toLowerCase();
            if (VALID_DIRS.has(dir)) {
              if (!p.dir || p.dir === '' || p.dir !== OPPOSITE[dir]) {
                p.dir = dir;
              }
            }
          }
          break;
        }

        case 'ready': {
          const p = this.players.find(pl => String(pl.userId) === String(userId));
          if (p) {
            p.ready = p.ready ? 0 : 1;
            this.broadcastLobby();
          }
          break;
        }

        case 'start': {
          if (this.room.hostId !== String(userId)) break;
          if (this.players.length < 2) break;
          const readyCount = this.players.filter(p => p.ready).length;
          if (readyCount < 2) break;

          const GRID_W = this.room.gridW || 640;
          const GRID_H = this.room.gridH || 480;

          this.room.status = 'playing';
          for (let i = 0; i < this.players.length; i++) {
            const pos = this.getStartPos(i, GRID_W, GRID_H);
            this.players[i].x = pos.x;
            this.players[i].y = pos.y;
            this.players[i].dir = pos.dir;
            this.players[i].alive = 1;
            this.players[i].trail = [];
          }
          this.startGameLoop();
          this.broadcastState();
          break;
        }

        case 'end': {
          if (this.room.hostId !== String(userId)) break;
          this.room.status = 'finished';
          this.room.winnerId = null;
          this.stopGameLoop();
          await this.persistResults();
          this.broadcastState();
          break;
        }

        case 'rematch': {
          if (this.room.hostId !== String(userId)) break;
          const GRID_W = this.room.gridW || 640;
          const GRID_H = this.room.gridH || 480;
          this.room.status = 'waiting';
          this.room.winnerId = null;
          this.stopGameLoop();
          for (let i = 0; i < this.players.length; i++) {
            const pos = this.getStartPos(i, GRID_W, GRID_H);
            this.players[i].x = pos.x;
            this.players[i].y = pos.y;
            this.players[i].dir = pos.dir;
            this.players[i].alive = 1;
            this.players[i].trail = [];
            this.players[i].ready = 0;
          }
          this.broadcastLobby();
          break;
        }

        case 'leave': {
          this.removePlayer(userId);
          break;
        }
      }
    } catch (e) {
      console.error('handleMessage error:', e);
    }
  }

  removePlayer(userId) {
    const idx = this.players.findIndex(p => String(p.userId) === String(userId));
    if (idx < 0) return;

    this.players.splice(idx, 1);
    this.connections.delete(String(userId));

    if (this.players.length === 0) {
      this.stopGameLoop();
      return;
    }

    if (this.room.hostId === String(userId)) {
      this.room.hostId = this.players[0].userId;
    }

    if (this.room.status === 'playing') {
      const aliveCount = this.players.filter(p => p.alive).length;
      if (aliveCount <= 1) {
        const winner = this.players.find(p => p.alive);
        this.room.status = 'finished';
        this.room.winnerId = winner ? winner.userId : null;
        this.stopGameLoop();
        this.persistResults();
      }
    }

    this.broadcastLobby();
  }

  startGameLoop() {
    if (this.gameLoop) return;
    this.started = true;
    const tickMs = this.room.speed === 'fast' ? 50 : this.room.speed === 'slow' ? 120 : 80;
    this.gameLoop = setInterval(() => this.tick(), tickMs);
  }

  stopGameLoop() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.started = false;
  }

  tick() {
    if (this.room.status !== 'playing') {
      this.stopGameLoop();
      return;
    }

    const GRID_W = this.room.gridW || 640;
    const GRID_H = this.room.gridH || 480;

    const alivePlayers = this.players.filter(p => p.alive);
    if (alivePlayers.length < 2) {
      const winner = alivePlayers[0] || null;
      this.room.status = 'finished';
      this.room.winnerId = winner ? winner.userId : null;
      this.stopGameLoop();
      this.persistResults();
      this.broadcastState();
      return;
    }

    const occupied = new Set();
    for (const p of this.players) {
      for (const pt of p.trail) {
        occupied.add(pt.x + ',' + pt.y);
      }
      occupied.add(p.x + ',' + p.y);
    }

    const toKill = [];
    const moves = [];
    const targetCounts = {};

    for (const p of alivePlayers) {
      if (p.dir && DIR_MAP[p.dir]) {
        const d = DIR_MAP[p.dir];
        const nx = p.x + d.dx;
        const ny = p.y + d.dy;
        moves.push({ player: p, nx, ny });
        const key = nx + ',' + ny;
        targetCounts[key] = (targetCounts[key] || 0) + 1;
      }
    }

    for (const m of moves) {
      const { player: p, nx, ny } = m;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) { toKill.push(p); continue; }
      const key = nx + ',' + ny;
      if (occupied.has(key)) { toKill.push(p); continue; }
      if (targetCounts[key] > 1) { toKill.push(p); continue; }

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 200) p.trail = p.trail.slice(-200);
      p.x = nx;
      p.y = ny;
    }

    for (const p of toKill) {
      p.alive = 0;
    }

    this.broadcastState();
  }

  broadcastState() {
    const msg = JSON.stringify({
      type: 'state',
      room: {
        code: this.room.code,
        status: this.room.status,
        hostId: this.room.hostId,
        maxPlayers: this.room.maxPlayers,
        speed: this.room.speed,
      },
      gridSize: { w: this.room.gridW || 640, h: this.room.gridH || 480 },
      players: this.players.map(p => ({
        id: p.id, userId: p.userId, username: p.username,
        x: p.x, y: p.y, dir: p.dir, alive: !!p.alive,
        ready: !!p.ready, color: p.color, trail: p.trail,
      })),
      winner: this.room.winnerId || null,
    });

    for (const [uid, ws] of this.connections) {
      try { ws.send(msg); } catch {}
    }
  }

  broadcastLobby() {
    const msg = JSON.stringify({
      type: 'lobby',
      room: {
        code: this.room.code,
        status: this.room.status,
        hostId: this.room.hostId,
        maxPlayers: this.room.maxPlayers,
        speed: this.room.speed,
      },
      players: this.players.map(p => ({
        id: p.id, userId: p.userId, username: p.username,
        ready: !!p.ready, color: p.color, side: p.side,
      })),
    });

    for (const [uid, ws] of this.connections) {
      try { ws.send(msg); } catch {}
    }
  }

  async persistResults() {
    try {
      const db = this.env.DATABASE;
      if (this.room.status === 'finished' && this.room.code) {
        await db.prepare("UPDATE tron_rooms SET status = 'finished', winner_id = ? WHERE code = ?")
          .bind(this.room.winnerId || null, this.room.code).run();
      }
    } catch (e) {
      console.error('persistResults error:', e);
    }
  }
}
