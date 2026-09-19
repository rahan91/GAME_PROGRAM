const PADDLE_SPEED = 0.045;
const PADDLE_HALF = 0.12;
const BALL_BASE_SPEED = 0.012;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function findNearestPaddle(players, ballCoord, wallSide) {
  const candidates = players.filter(p => p.side === wallSide && p.alive);
  if (!candidates.length) return null;
  return candidates.reduce((best, p) => {
    const dist = Math.abs(p.paddle_y - ballCoord);
    return dist < best.dist ? { paddle: p, dist } : best;
  }, { paddle: candidates[0], dist: Infinity }).paddle;
}

export class PongGame {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = [];
    this.ball = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
    this.room = {};
    this.connections = new Map();
    this.gameLoop = null;
    this.started = false;
    this.ticks = 0;
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
    const roomRow = await db.prepare('SELECT id, code, mode, status, host_id, max_players, speed, rounds_target, round_num FROM pong_rooms WHERE id = ?').bind(roomId).first();
    if (!roomRow) return;

    this.room = {
      id: roomRow.id,
      code: roomRow.code,
      mode: roomRow.mode || 'teams',
      status: roomRow.status || 'waiting',
      hostId: roomRow.host_id,
      maxPlayers: roomRow.max_players || 4,
      speed: roomRow.speed || 'medium',
      roundsTarget: roomRow.rounds_target || 3,
      roundNum: roomRow.round_num || 0,
    };

    const playerRows = await db.prepare('SELECT id, user_id, username, side, paddle_y, alive, ready, dir, color FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC').bind(roomId).all();
    this.players = (playerRows.results || []).map(p => ({
      id: p.id,
      userId: String(p.user_id),
      username: p.username,
      color: p.color || 'rgba(0,229,255,0.85)',
      side: p.side,
      paddle_y: p.paddle_y || 0.5,
      alive: p.alive ? 1 : 0,
      ready: p.ready ? 1 : 0,
      dir: p.dir || 0,
    }));

    const ballRow = await db.prepare('SELECT x, y, vx, vy, speed FROM pong_ball WHERE room_id = ?').bind(roomId).first();
    if (ballRow) {
      this.ball = { x: Number(ballRow.x), y: Number(ballRow.y), vx: Number(ballRow.vx), vy: Number(ballRow.vy), speed: Number(ballRow.speed) || BALL_BASE_SPEED };
    }

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

    if (this.players.length >= (this.room.maxPlayers || 4)) {
      ws.send(JSON.stringify({ type: 'error', error: 'Room full' }));
      ws.close(4004, 'Room full');
      return;
    }

    const mode = this.room.mode || 'teams';
    let side;
    if (mode === 'quads') {
      const quadSides = ['top', 'right', 'bottom', 'left'];
      const takenSides = new Set(this.players.map(p => p.side));
      side = quadSides.find(s => !takenSides.has(s)) || 'top';
    } else {
      const leftCount = this.players.filter(p => p.side === 'left').length;
      const rightCount = this.players.filter(p => p.side === 'right').length;
      side = leftCount <= rightCount ? 'left' : 'right';
    }

    const player = {
      id: crypto.randomUUID(),
      userId: String(userId),
      username,
      color,
      side,
      paddle_y: 0.5,
      alive: 1,
      ready: 0,
      dir: 0,
    };

    this.players.push(player);
    this.connections.set(String(userId), ws);

    const playerIndex = this.players.length - 1;
    ws.send(JSON.stringify({ type: 'welcome', playerIndex, room: this.room }));
    this.broadcastLobby();
  }

  async handleMessage(userId, message) {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'input': {
          const p = this.players.find(pl => String(pl.userId) === String(userId));
          if (p && p.alive) {
            const dir = Number(msg.dir);
            if (Number.isInteger(dir) && dir >= -1 && dir <= 1) {
              p.dir = dir;
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

          this.room.status = 'playing';
          this.room.roundNum = 0;
          for (const p of this.players) {
            p.paddle_y = 0.5;
            p.alive = 1;
            p.dir = 0;
          }
          this.resetBall();
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
          this.room.status = 'waiting';
          this.room.roundNum = 0;
          this.room.winnerId = null;
          this.ball = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
          this.stopGameLoop();
          for (const p of this.players) {
            p.paddle_y = 0.5;
            p.alive = 1;
            p.dir = 0;
            p.ready = 0;
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

  resetBall() {
    const speedMul = this.room.speed === 'fast' ? 1.5 : this.room.speed === 'slow' ? 0.7 : 1;
    const angle = Math.random() * Math.PI * 2;
    this.ball = {
      x: 0.5, y: 0.5,
      vx: Math.cos(angle) * BALL_BASE_SPEED * speedMul,
      vy: Math.sin(angle) * BALL_BASE_SPEED * speedMul,
    };
  }

  startGameLoop() {
    if (this.gameLoop) return;
    this.started = true;
    this.gameLoop = setInterval(() => this.tick(), 40);
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

    this.ticks++;
    const speedMul = this.room.speed === 'fast' ? 1.5 : this.room.speed === 'slow' ? 0.7 : 1;

    for (const p of this.players) {
      if (!p.alive) continue;
      const newY = clamp(p.paddle_y + p.dir * PADDLE_SPEED, PADDLE_HALF, 1 - PADDLE_HALF);
      p.paddle_y = newY;
    }

    let { x: bx, y: by, vx: bvx, vy: bvy } = this.ball;

    const alivePlayers = this.players.filter(p => p.alive);
    const aliveSides = new Set(alivePlayers.map(p => p.side));

    if (aliveSides.size >= 2) {
      bx += bvx * speedMul;
      by += bvy * speedMul;

      if (!aliveSides.has('top') && by <= 0.02) { by = 0.02; bvy = Math.abs(bvy); }
      if (!aliveSides.has('bottom') && by >= 0.98) { by = 0.98; bvy = -Math.abs(bvy); }
      if (!aliveSides.has('left') && bx <= 0.02) { bx = 0.02; bvx = Math.abs(bvx); }
      if (!aliveSides.has('right') && bx >= 0.98) { bx = 0.98; bvx = -Math.abs(bvx); }

      let hitSides = new Set();
      for (const p of alivePlayers) {
        if (hitSides.has(p.side)) continue;
        if (p.side === 'top') {
          const pL = p.paddle_y - PADDLE_HALF, pR = p.paddle_y + PADDLE_HALF;
          if (bx >= pL && bx <= pR && by <= 0.06 && bvy < 0) { by = 0.06; bvy = Math.abs(bvy) * 1.03; bvx += ((bx - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('top'); }
        } else if (p.side === 'bottom') {
          const pL = p.paddle_y - PADDLE_HALF, pR = p.paddle_y + PADDLE_HALF;
          if (bx >= pL && bx <= pR && by >= 0.94 && bvy > 0) { by = 0.94; bvy = -Math.abs(bvy) * 1.03; bvx += ((bx - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('bottom'); }
        } else if (p.side === 'left') {
          const pT = p.paddle_y - PADDLE_HALF, pB = p.paddle_y + PADDLE_HALF;
          if (by >= pT && by <= pB && bx <= 0.06 && bvx < 0) { bx = 0.06; bvx = Math.abs(bvx) * 1.03; bvy += ((by - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('left'); }
        } else if (p.side === 'right') {
          const pT = p.paddle_y - PADDLE_HALF, pB = p.paddle_y + PADDLE_HALF;
          if (by >= pT && by <= pB && bx >= 0.94 && bvx > 0) { bx = 0.94; bvx = -Math.abs(bvx) * 1.03; bvy += ((by - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('right'); }
        }
      }

      const baseSpd = Number(this.ball.speed) || BALL_BASE_SPEED;
      const curSpd = Math.sqrt(bvx * bvx + bvy * bvy);
      if (curSpd > 0) {
        const target = baseSpd * speedMul * 1.15;
        bvx = (bvx / curSpd) * Math.min(curSpd, target);
        bvy = (bvy / curSpd) * Math.min(curSpd, target);
      }
      bvx = clamp(bvx, -0.04, 0.04);
      bvy = clamp(bvy, -0.04, 0.04);

      let scoredSide = null;
      if (by < -0.02) scoredSide = 'top';
      else if (by > 1.02) scoredSide = 'bottom';
      else if (bx < -0.02) scoredSide = 'left';
      else if (bx > 1.02) scoredSide = 'right';

      if (scoredSide) {
        const victim = findNearestPaddle(alivePlayers, scoredSide === 'left' || scoredSide === 'right' ? by : bx, scoredSide);
        if (victim) victim.alive = 0;

        this.resetBall();
        bx = this.ball.x; by = this.ball.y; bvx = this.ball.vx; bvy = this.ball.vy;

        const aliveAfter = this.players.filter(p => p.alive);
        const aliveSidesAfter = new Set(aliveAfter.map(p => p.side));

        if (aliveSidesAfter.size <= 1) {
          const survivingSide = aliveSidesAfter.size === 1 ? [...aliveSidesAfter][0] : null;
          let roundNum = this.room.roundNum || 0;
          if (survivingSide === 'left' || survivingSide === 'top') roundNum++;
          else if (survivingSide === 'right' || survivingSide === 'bottom') roundNum--;
          this.room.roundNum = roundNum;

          const absScore = Math.abs(roundNum);
          const target = this.room.roundsTarget || 3;

          if (absScore >= target) {
            const wp = aliveAfter.find(p => p.side === survivingSide);
            this.room.status = 'finished';
            this.room.winnerId = wp ? wp.userId : null;
            this.stopGameLoop();
            this.persistResults();
          } else {
            for (const p of this.players) {
              p.paddle_y = 0.5;
              p.alive = 1;
              p.dir = 0;
            }
          }
        }
      }

      this.ball = { x: bx, y: by, vx: bvx, vy: bvy, speed: this.ball.speed };
    }

    this.broadcastState();
  }

  broadcastState() {
    const leftScore = (this.room.roundNum || 0) > 0 ? this.room.roundNum : 0;
    const rightScore = (this.room.roundNum || 0) < 0 ? Math.abs(this.room.roundNum) : 0;

    const msg = JSON.stringify({
      type: 'state',
      room: {
        code: this.room.code,
        mode: this.room.mode,
        status: this.room.status,
        hostId: this.room.hostId,
        maxPlayers: this.room.maxPlayers,
        speed: this.room.speed,
        roundsTarget: this.room.roundsTarget || 3,
        roundNum: this.room.roundNum || 0,
        leftScore,
        rightScore,
      },
      players: this.players.map(p => ({
        id: p.id, userId: p.userId, username: p.username,
        side: p.side, paddleY: p.paddle_y, alive: !!p.alive,
        ready: !!p.ready, color: p.color,
      })),
      ball: { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy },
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
        mode: this.room.mode,
        status: this.room.status,
        hostId: this.room.hostId,
        maxPlayers: this.room.maxPlayers,
        speed: this.room.speed,
        roundsTarget: this.room.roundsTarget || 3,
      },
      players: this.players.map(p => ({
        id: p.id, userId: p.userId, username: p.username,
        side: p.side, ready: !!p.ready, color: p.color,
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
        const writes = [];
        writes.push(
          db.prepare("UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE code = ?")
            .bind(this.room.winnerId || null, this.room.code)
        );
        if (writes.length) await db.batch(writes);
      }
    } catch (e) {
      console.error('persistResults error:', e);
    }
  }
}
