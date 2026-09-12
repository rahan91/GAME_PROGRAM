import { json, getUserFromRequest } from '../../_lib/auth.js';

const ROOM_EXPIRY_SECONDS = 30 * 60;
const MAX_PLAYERS = 8;
const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1',
];

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const action = String((body && body.action) || '').toLowerCase();
  const db = context.env.DATABASE;
  const now = Math.floor(Date.now() / 1000);

  if (action === 'create') {
    return handleCreate(db, user, body, now);
  } else if (action === 'join') {
    return handleJoin(db, user, body, now);
  } else if (action === 'leave') {
    return handleLeave(db, user, body, now);
  } else if (action === 'ready') {
    return handleReady(db, user, body);
  } else if (action === 'start') {
    return handleStart(db, user, body, now);
  }

  return json({ error: 'Unknown action' }, 400);
}

async function handleCreate(db, user, body, now) {
  const existing = await db.prepare(
    'SELECT room_id FROM pong_players WHERE user_id = ?'
  ).bind(user.id).first();
  if (existing) return json({ error: 'Already in a room' }, 409);

  const roomId = generateRoomId();
  const code = body && body.code ? String(body.code).slice(0, 6) : generateCode();
  const mode = (body && body.mode === 'teams') ? 'teams' : 'ffa';
  const expiresAt = now + ROOM_EXPIRY_SECONDS;

  await db.prepare(
    `INSERT INTO pong_rooms (id, code, mode, status, host_id, created_at, expires_at)
     VALUES (?, ?, ?, 'waiting', ?, ?, ?)`
  ).bind(roomId, code, mode, user.id, now, expiresAt).run();

  const side = 'left';
  await db.prepare(
    `INSERT INTO pong_players (room_id, user_id, username, rating, side, paddle_y, alive, ready, dir, color, joined_at)
     VALUES (?, ?, ?, 1200, ?, 0.5, 1, 0, 0, ?, ?)`
  ).bind(roomId, user.id, user.username, side, COLORS[0], now).run();

  return json({ roomId, code, mode, status: 'waiting', hostId: user.id });
}

async function handleJoin(db, user, body, now) {
  const inRoom = await db.prepare(
    'SELECT room_id FROM pong_players WHERE user_id = ?'
  ).bind(user.id).first();
  if (inRoom) return json({ error: 'Already in a room' }, 409);

  const code = body && body.code ? String(body.code).toUpperCase() : null;
  let room;

  if (code) {
    room = await db.prepare(
      "SELECT * FROM pong_rooms WHERE code = ? AND status = 'waiting'"
    ).bind(code).first();
    if (!room) return json({ error: 'Room not found or already started' }, 404);
  } else {
    room = await findMatch(db, now);
    if (!room) {
      const roomId = generateRoomId();
      const roomCode = generateCode();
      const expiresAt = now + ROOM_EXPIRY_SECONDS;
      await db.prepare(
        `INSERT INTO pong_rooms (id, code, mode, status, host_id, created_at, expires_at)
         VALUES (?, ?, 'ffa', 'waiting', ?, ?, ?)`
      ).bind(roomId, roomCode, user.id, now, expiresAt).run();
      room = { id: roomId, code: roomCode, mode: 'ffa', status: 'waiting', host_id: user.id };
    }
  }

  const playerCount = await db.prepare(
    'SELECT COUNT(*) as cnt FROM pong_players WHERE room_id = ?'
  ).bind(room.id).first();
  if (playerCount.cnt >= MAX_PLAYERS) return json({ error: 'Room is full' }, 409);

  const side = playerCount.cnt % 2 === 0 ? 'left' : 'right';
  const color = COLORS[playerCount.cnt % COLORS.length];

  await db.prepare(
    `INSERT INTO pong_players (room_id, user_id, username, rating, side, paddle_y, alive, ready, dir, color, joined_at)
     VALUES (?, ?, ?, 1200, ?, 0.5, 1, 0, 0, ?, ?)`
  ).bind(room.id, user.id, user.username, side, color, now).run();

  await db.prepare(
    'UPDATE pong_rooms SET expires_at = ? WHERE id = ?'
  ).bind(now + ROOM_EXPIRY_SECONDS, room.id).run();

  return json({ roomId: room.id, code: room.code, mode: room.mode, status: room.status });
}

async function handleLeave(db, user, body, now) {
  const roomId = body && body.room ? String(body.room) : null;
  if (!roomId) return json({ error: 'Missing room' }, 400);

  const player = await db.prepare(
    'SELECT id FROM pong_players WHERE room_id = ? AND user_id = ?'
  ).bind(roomId, user.id).first();
  if (!player) return json({ error: 'Not in room' }, 404);

  await db.prepare(
    'DELETE FROM pong_players WHERE room_id = ? AND user_id = ?'
  ).bind(roomId, user.id).run();

  const remaining = await db.prepare(
    'SELECT COUNT(*) as cnt FROM pong_players WHERE room_id = ?'
  ).bind(roomId).first();

  if (remaining.cnt === 0) {
    await db.prepare('DELETE FROM pong_rooms WHERE id = ?').bind(roomId).run();
    await db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(roomId).run();
  } else {
    const hostGone = await db.prepare(
      'SELECT user_id FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC LIMIT 1'
    ).bind(roomId).first();
    if (hostGone) {
      await db.prepare(
        'UPDATE pong_rooms SET host_id = ? WHERE id = ?'
      ).bind(hostGone.user_id, roomId).run();
    }
  }

  return json({ ok: true });
}

async function handleReady(db, user, body) {
  const roomId = body && body.room ? String(body.room) : null;
  if (!roomId) return json({ error: 'Missing room' }, 400);

  const player = await db.prepare(
    'SELECT ready FROM pong_players WHERE room_id = ? AND user_id = ?'
  ).bind(roomId, user.id).first();
  if (!player) return json({ error: 'Not in room' }, 404);

  const newReady = player.ready ? 0 : 1;
  await db.prepare(
    'UPDATE pong_players SET ready = ? WHERE room_id = ? AND user_id = ?'
  ).bind(newReady, roomId, user.id).run();

  return json({ ready: !!newReady });
}

async function handleStart(db, user, body, now) {
  const roomId = body && body.room ? String(body.room) : null;
  if (!roomId) return json({ error: 'Missing room' }, 400);

  const room = await db.prepare(
    'SELECT * FROM pong_rooms WHERE id = ?'
  ).bind(roomId).first();
  if (!room) return json({ error: 'Room not found' }, 404);
  if (room.host_id !== user.id) return json({ error: 'Not host' }, 403);
  if (room.status !== 'waiting') return json({ error: 'Game already started' }, 409);

  const players = await db.prepare(
    'SELECT COUNT(*) as cnt FROM pong_players WHERE room_id = ?'
  ).bind(roomId).first();
  if (players.cnt < 2) return json({ error: 'Need at least 2 players' }, 400);

  await db.prepare(
    "UPDATE pong_rooms SET status = 'playing', expires_at = ? WHERE id = ?"
  ).bind(now + ROOM_EXPIRY_SECONDS, roomId).run();

  const leftPlayers = await db.prepare(
    "SELECT user_id FROM pong_players WHERE room_id = ? AND side = 'left'"
  ).bind(roomId).all();
  const rightPlayers = await db.prepare(
    "SELECT user_id FROM pong_players WHERE room_id = ? AND side = 'right'"
  ).bind(roomId).all();

  const leftCenter = 0.5;
  const rightCenter = 0.5;

  for (const p of (leftPlayers.results || [])) {
    await db.prepare(
      'UPDATE pong_players SET paddle_y = ?, alive = 1 WHERE room_id = ? AND user_id = ?'
    ).bind(leftCenter, roomId, p.user_id).run();
  }
  for (const p of (rightPlayers.results || [])) {
    await db.prepare(
      'UPDATE pong_players SET paddle_y = ?, alive = 1 WHERE room_id = ? AND user_id = ?'
    ).bind(rightCenter, roomId, p.user_id).run();
  }

  await db.prepare(
    `INSERT INTO pong_ball (room_id, x, y, vx, vy, speed)
     VALUES (?, 0.5, 0.5, 0.03, 0.01, 5)`
  ).bind(roomId).run();

  return json({ ok: true, status: 'playing' });
}

async function findMatch(db, now) {
  const candidates = await db.prepare(
    `SELECT r.id, r.code, r.mode, r.status, r.host_id,
            (SELECT COUNT(*) FROM pong_players p WHERE p.room_id = r.id) as player_count
     FROM pong_rooms r
     WHERE r.status = 'waiting' AND r.expires_at > ?
     ORDER BY player_count DESC`
  ).bind(now).all();

  for (const room of (candidates.results || [])) {
    if (room.player_count < MAX_PLAYERS) return room;
  }
  return null;
}
