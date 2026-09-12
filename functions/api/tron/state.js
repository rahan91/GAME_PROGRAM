import { json } from '../../_lib/auth.js';

const GRID_W = 640;
const GRID_H = 480;
const DIR_MAP = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('room');
  if (!code) return json({ error: 'Missing room parameter' }, 400);

  const db = context.env.DATABASE;

  const room = await db.prepare(
    'SELECT id, code, status, host_id, max_players, speed FROM tron_rooms WHERE code = ?'
  ).bind(code.toUpperCase()).first();
  if (!room) return json({ error: 'Room not found' }, 404);

  const playerRows = await db.prepare(
    `SELECT id, user_id, username, rating, x, y, dir, alive, ready, color, trail
     FROM tron_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();
  const players = (playerRows.results || []).map(p => ({
    ...p,
    trail: p.trail ? JSON.parse(p.trail) : [],
  }));

  // Game tick: advance one step if playing
  if (room.status === 'playing') {
    const alivePlayers = players.filter(p => p.alive);
    if (alivePlayers.length < 2) {
      // Game over — last alive wins (or no one)
      const winner = alivePlayers[0] || null;
      await db.prepare(
        "UPDATE tron_rooms SET status = 'finished', winner_id = ? WHERE id = ?"
      ).bind(winner ? winner.user_id : null, room.id).run();
      room.status = 'finished';
    } else {
      // Build collision grid from all trails
      const occupied = new Set();
      for (const p of players) {
        for (const pt of p.trail) {
          occupied.add(pt.x + ',' + pt.y);
        }
      }

      const toKill = [];

      for (const p of alivePlayers) {
        if (p.dir && DIR_MAP[p.dir]) {
          const d = DIR_MAP[p.dir];
          const nx = p.x + d.dx;
          const ny = p.y + d.dy;

          // Wall collision
          if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) {
            toKill.push(p);
            continue;
          }

          // Trail collision (other players' trails — but not your own current head position)
          const key = nx + ',' + ny;
          if (occupied.has(key)) {
            toKill.push(p);
            continue;
          }

          // Move: add old head to trail, update position
          p.trail.push({ x: p.x, y: p.y });
          p.x = nx;
          p.y = ny;
        }
      }

      // Kill players who crashed
      for (const p of toKill) {
        p.alive = 0;
        await db.prepare(
          'UPDATE tron_players SET alive = 0 WHERE id = ?'
        ).bind(p.id).run();
      }

      // Save moved players
      for (const p of alivePlayers) {
        if (!toKill.includes(p)) {
          await db.prepare(
            'UPDATE tron_players SET x = ?, y = ?, trail = ? WHERE id = ?'
          ).bind(p.x, p.y, JSON.stringify(p.trail), p.id).run();
        }
      }

      // Check if game should end
      const stillAlive = players.filter(p => p.alive);
      if (stillAlive.length <= 1) {
        const winner = stillAlive[0] || null;
        await db.prepare(
          "UPDATE tron_rooms SET status = 'finished', winner_id = ? WHERE id = ?"
        ).bind(winner ? winner.user_id : null, room.id).run();
        room.status = 'finished';
      }
    }
  }

  let winner = null;
  let winnerName = null;
  if (room.status === 'finished') {
    const finished = await db.prepare('SELECT winner_id FROM tron_rooms WHERE id = ?').bind(room.id).first();
    winner = finished ? finished.winner_id : null;
    if (winner) {
      const wp = await db.prepare('SELECT username FROM tron_players WHERE room_id = ? AND user_id = ?').bind(room.id, winner).first();
      winnerName = wp ? wp.username : null;
    }
  }

  return json({
    room: { id: room.id, code: room.code, status: room.status, hostId: room.host_id, maxPlayers: room.max_players, speed: room.speed },
    gridSize: { w: GRID_W, h: GRID_H },
    players: players.map((p) => ({
      id: p.id,
      userId: p.user_id,
      username: p.username,
      rating: p.rating,
      x: p.x,
      y: p.y,
      dir: p.dir,
      alive: !!p.alive,
      ready: !!p.ready,
      color: p.color,
      trail: p.trail,
    })),
    winner,
    winnerName,
  });
}
