import { json, getUserFromRequest } from '../../_lib/auth.js';

const ROOM_EXPIRY_SECONDS = 30 * 60;
const MAX_PLAYERS = 8;
const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1',
];

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function findRoomByCode(db, code) {
  return db.prepare('SELECT * FROM pong_rooms WHERE code = ?').bind(code).first();
}

async function getPlayerCount(db, roomId) {
  const r = await db.prepare('SELECT COUNT(*) as cnt FROM pong_players WHERE room_id = ?').bind(roomId).first();
  return r ? r.cnt : 0;
}

async function getPlayerIndex(db, roomId, userId) {
  const r = await db.prepare(
    'SELECT COUNT(*) as idx FROM pong_players WHERE room_id = ? AND joined_at < (SELECT joined_at FROM pong_players WHERE room_id = ? AND user_id = ?)'
  ).bind(roomId, roomId, userId).first();
  return r ? r.idx : 0;
}

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const action = String((body && body.action) || '').toLowerCase();
  const db = context.env.DATABASE;
  const now = Math.floor(Date.now() / 1000);

  if (action === 'create') return handleCreate(db, user, body, now);
  if (action === 'join') return handleJoin(db, user, body, now);
  if (action === 'leave') return handleLeave(db, user, body);
  if (action === 'ready') return handleReady(db, user, body);
  if (action === 'start') return handleStart(db, user, body, now);
  if (action === 'end') return handleEnd(db, user, body);
  return json({ error: 'Unknown action' }, 400);
}

async function handleCreate(db, user, body, now) {
  const existing = await db.prepare('SELECT room_id FROM pong_players WHERE user_id = ?').bind(user.id).first();
  if (existing) {
    await db.prepare('DELETE FROM pong_players WHERE room_id = ? AND user_id = ?').bind(existing.room_id, user.id).run();
  }

  const roomId = crypto.randomUUID();
  const code = generateCode();
  const mode = (body && body.mode === 'teams') ? 'teams' : 'ffa';
  const maxPlayers = [2, 4, 6, 8].includes(Number(body?.maxPlayers)) ? Number(body.maxPlayers) : 8;
  const speed = ['slow', 'medium', 'fast'].includes(body?.speed) ? body.speed : 'medium';
  const expiresAt = now + ROOM_EXPIRY_SECONDS;

  await db.prepare(
    `INSERT INTO pong_rooms (id, code, mode, status, host_id, max_players, speed, created_at, expires_at)
     VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?, ?)`
  ).bind(roomId, code, mode, user.id, maxPlayers, speed, now, expiresAt).run();

  await db.prepare(
    `INSERT INTO pong_players (room_id, user_id, username, rating, side, paddle_y, alive, ready, dir, color, joined_at)
     VALUES (?, ?, ?, 1200, 'left', 0.5, 1, 0, 0, ?, ?)`
  ).bind(roomId, user.id, user.username, COLORS[0], now).run();

  const playerIndex = 0;
  return json({ code, mode, maxPlayers, speed, status: 'waiting', playerIndex });
}

async function handleJoin(db, user, body, now) {
  const inRoom = await db.prepare('SELECT room_id FROM pong_players WHERE user_id = ?').bind(user.id).first();
  if (inRoom) {
    await db.prepare('DELETE FROM pong_players WHERE room_id = ? AND user_id = ?').bind(inRoom.room_id, user.id).run();
  }

  const code = body && body.code ? String(body.code).toUpperCase() : null;
  let room;

  if (code) {
    room = await db.prepare("SELECT * FROM pong_rooms WHERE code = ? AND status = 'waiting'").bind(code).first();
    if (!room) return json({ error: 'Room not found or already started' }, 404);
  } else {
    room = await findMatch(db, now);
    if (!room) {
      const roomId = crypto.randomUUID();
      const roomCode = generateCode();
      const expiresAt = now + ROOM_EXPIRY_SECONDS;
      await db.prepare(
        `INSERT INTO pong_rooms (id, code, mode, status, host_id, created_at, expires_at)
         VALUES (?, ?, 'ffa', 'waiting', ?, ?, ?)`
      ).bind(roomId, roomCode, user.id, now, expiresAt).run();
      room = { id: roomId, code: roomCode, mode: 'ffa', status: 'waiting', host_id: user.id, max_players: 8, speed: 'medium' };
    }
  }

  const playerCount = await getPlayerCount(db, room.id);
  if (playerCount >= (room.max_players || MAX_PLAYERS)) return json({ error: 'Room is full' }, 409);

  // Assign side: count per side, put on the side with fewer players
  const leftCount = await db.prepare("SELECT COUNT(*) as c FROM pong_players WHERE room_id = ? AND side = 'left'").bind(room.id).first();
  const rightCount = await db.prepare("SELECT COUNT(*) as c FROM pong_players WHERE room_id = ? AND side = 'right'").bind(room.id).first();
  const side = (leftCount.c <= rightCount.c) ? 'left' : 'right';
  const color = COLORS[playerCount % COLORS.length];

  await db.prepare(
    `INSERT INTO pong_players (room_id, user_id, username, rating, side, paddle_y, alive, ready, dir, color, joined_at)
     VALUES (?, ?, ?, 1200, ?, 0.5, 1, 0, 0, ?, ?)`
  ).bind(room.id, user.id, user.username, side, color, now).run();

  await db.prepare('UPDATE pong_rooms SET expires_at = ? WHERE id = ?').bind(now + ROOM_EXPIRY_SECONDS, room.id).run();

  const playerIndex = playerCount;
  return json({ code: room.code, mode: room.mode, maxPlayers: room.max_players, speed: room.speed, status: room.status, playerIndex, hostId: room.host_id });
}

async function handleLeave(db, user, body) {
  const code = body && body.code ? String(body.code).toUpperCase() : null;
  if (!code) return json({ error: 'Missing code' }, 400);

  const room = await findRoomByCode(db, code);
  if (!room) return json({ error: 'Room not found' }, 404);

  await db.prepare('DELETE FROM pong_players WHERE room_id = ? AND user_id = ?').bind(room.id, user.id).run();

  const remaining = await getPlayerCount(db, room.id);
  if (remaining === 0) {
    await db.prepare('DELETE FROM pong_rooms WHERE id = ?').bind(room.id).run();
    await db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id).run();
  } else {
    const hostGone = await db.prepare(
      'SELECT user_id FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC LIMIT 1'
    ).bind(room.id).first();
    if (hostGone) {
      await db.prepare('UPDATE pong_rooms SET host_id = ? WHERE id = ?').bind(hostGone.user_id, room.id).run();
    }
  }

  return json({ ok: true });
}

async function handleReady(db, user, body) {
  const code = body && body.code ? String(body.code).toUpperCase() : null;
  if (!code) return json({ error: 'Missing code' }, 400);

  const room = await findRoomByCode(db, code);
  if (!room) return json({ error: 'Room not found' }, 404);

  const player = await db.prepare(
    'SELECT ready FROM pong_players WHERE room_id = ? AND user_id = ?'
  ).bind(room.id, user.id).first();
  if (!player) return json({ error: 'Not in room' }, 404);

  const newReady = body && body.ready !== undefined ? (body.ready ? 1 : 0) : (player.ready ? 0 : 1);
  await db.prepare(
    'UPDATE pong_players SET ready = ? WHERE room_id = ? AND user_id = ?'
  ).bind(newReady, room.id, user.id).run();

  return json({ ok: true, ready: !!newReady });
}

async function handleStart(db, user, body, now) {
  const code = body && body.code ? String(body.code).toUpperCase() : null;
  if (!code) return json({ error: 'Missing code' }, 400);

  const room = await findRoomByCode(db, code);
  if (!room) return json({ error: 'Room not found' }, 404);
  if (String(room.host_id) !== String(user.id)) return json({ error: 'Not host' }, 403);
  if (room.status !== 'waiting') return json({ error: 'Game already started' }, 409);

  const playerCount = await getPlayerCount(db, room.id);
  if (playerCount < 2) return json({ error: 'Need at least 2 players' }, 400);

  const readyCount = await db.prepare('SELECT COUNT(*) as c FROM pong_players WHERE room_id = ? AND ready = 1').bind(room.id).first();
  if (readyCount.c < 2) return json({ error: 'Need at least 2 ready players' }, 400);

  await db.prepare("UPDATE pong_rooms SET status = 'playing', expires_at = ? WHERE id = ?").bind(now + ROOM_EXPIRY_SECONDS, room.id).run();

  const leftPlayers = await db.prepare("SELECT user_id FROM pong_players WHERE room_id = ? AND side = 'left'").bind(room.id).all();
  const rightPlayers = await db.prepare("SELECT user_id FROM pong_players WHERE room_id = ? AND side = 'right'").bind(room.id).all();

  for (const p of (leftPlayers.results || [])) {
    await db.prepare('UPDATE pong_players SET paddle_y = 0.5, alive = 1 WHERE room_id = ? AND user_id = ?').bind(room.id, p.user_id).run();
  }
  for (const p of (rightPlayers.results || [])) {
    await db.prepare('UPDATE pong_players SET paddle_y = 0.5, alive = 1 WHERE room_id = ? AND user_id = ?').bind(room.id, p.user_id).run();
  }

  const spd = room.speed === 'fast' ? 8 : room.speed === 'slow' ? 3 : 5;
  const vx = room.speed === 'fast' ? 0.045 : room.speed === 'slow' ? 0.02 : 0.03;
  await db.prepare(`INSERT INTO pong_ball (room_id, x, y, vx, vy, speed) VALUES (?, 0.5, 0.5, ?, 0.01, ?)`).bind(room.id, vx, spd).run();

  return json({ ok: true, status: 'playing' });
}

async function handleEnd(db, user, body) {
  const code = String(body && body.code || '').toUpperCase();
  if (!code) return json({ error: 'Missing code' }, 400);

  const room = await findRoomByCode(db, code);
  if (!room) return json({ error: 'Room not found' }, 404);
  if (String(room.host_id) !== String(user.id)) return json({ error: 'Not host' }, 403);
  if (room.status !== 'playing') return json({ error: 'Game not in progress' }, 409);

  let winnerId = null;
  if (body && body.winnerName) {
    const winner = await db.prepare('SELECT user_id FROM pong_players WHERE room_id = ? AND username = ?').bind(room.id, String(body.winnerName)).first();
    if (winner) winnerId = winner.user_id;
  }
  await db.prepare(
    "UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE id = ?"
  ).bind(winnerId, room.id).run();
  await db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id).run();

  return json({ ok: true, status: 'finished' });
}

async function findMatch(db, now) {
  const candidates = await db.prepare(
    `SELECT r.id, r.code, r.mode, r.status, r.host_id, r.max_players, r.speed,
            (SELECT COUNT(*) FROM pong_players p WHERE p.room_id = r.id) as player_count
     FROM pong_rooms r
     WHERE r.status = 'waiting' AND r.expires_at > ?
     ORDER BY player_count DESC`
  ).bind(now).all();

  for (const room of (candidates.results || [])) {
    if (room.player_count < (room.max_players || MAX_PLAYERS)) return room;
  }
  return null;
}
