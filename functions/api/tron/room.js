import { json, getUserFromRequest } from '../../_lib/auth.js';

const ROOM_EXPIRY_SECONDS = 30 * 60;
const MAX_PLAYERS = 8;
const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1',
];

const GRID_W = 640;
const GRID_H = 480;

const START_POSITIONS = [
  { x: 0,       y: 0,       dir: 'right' },
  { x: GRID_W-1,y: 0,       dir: 'left'  },
  { x: 0,       y: GRID_H-1,dir: 'right' },
  { x: GRID_W-1,y: GRID_H-1,dir: 'left'  },
  { x: Math.floor(GRID_W/2), y: 0,       dir: 'down'  },
  { x: Math.floor(GRID_W/2), y: GRID_H-1,dir: 'up'    },
  { x: 0,       y: Math.floor(GRID_H/2), dir: 'right' },
  { x: GRID_W-1,y: Math.floor(GRID_H/2), dir: 'left'  },
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
    'SELECT room_id FROM tron_players WHERE user_id = ?'
  ).bind(user.id).first();
  if (existing) return json({ error: 'Already in a room' }, 409);

  const roomId = generateRoomId();
  const code = body && body.code ? String(body.code).slice(0, 6) : generateCode();
  const expiresAt = now + ROOM_EXPIRY_SECONDS;

  await db.prepare(
    `INSERT INTO tron_rooms (id, code, status, host_id, created_at, expires_at)
     VALUES (?, ?, 'waiting', ?, ?, ?)`
  ).bind(roomId, code, user.id, now, expiresAt).run();

  const pos = START_POSITIONS[0];
  await db.prepare(
    `INSERT INTO tron_players (room_id, user_id, username, rating, x, y, dir, alive, ready, color, trail, joined_at)
     VALUES (?, ?, ?, 1200, ?, ?, ?, 1, 0, ?, '[]', ?)`
  ).bind(roomId, user.id, user.username, pos.x, pos.y, pos.dir, COLORS[0], now).run();

  return json({ roomId, code, status: 'waiting', hostId: user.id });
}

async function handleJoin(db, user, body, now) {
  const inRoom = await db.prepare(
    'SELECT room_id FROM tron_players WHERE user_id = ?'
  ).bind(user.id).first();
  if (inRoom) return json({ error: 'Already in a room' }, 409);

  const code = body && body.code ? String(body.code).toUpperCase() : null;
  let room;

  if (code) {
    room = await db.prepare(
      "SELECT * FROM tron_rooms WHERE code = ? AND status = 'waiting'"
    ).bind(code).first();
    if (!room) return json({ error: 'Room not found or already started' }, 404);
  } else {
    room = await findMatch(db, now);
    if (!room) {
      const roomId = generateRoomId();
      const roomCode = generateCode();
      const expiresAt = now + ROOM_EXPIRY_SECONDS;
      await db.prepare(
        `INSERT INTO tron_rooms (id, code, status, host_id, created_at, expires_at)
         VALUES (?, ?, 'waiting', ?, ?, ?)`
      ).bind(roomId, roomCode, user.id, now, expiresAt).run();
      room = { id: roomId, code: roomCode, status: 'waiting', host_id: user.id };
    }
  }

  const playerCount = await db.prepare(
    'SELECT COUNT(*) as cnt FROM tron_players WHERE room_id = ?'
  ).bind(room.id).first();
  if (playerCount.cnt >= MAX_PLAYERS) return json({ error: 'Room is full' }, 409);

  const pos = START_POSITIONS[playerCount.cnt % START_POSITIONS.length];
  const color = COLORS[playerCount.cnt % COLORS.length];

  await db.prepare(
    `INSERT INTO tron_players (room_id, user_id, username, rating, x, y, dir, alive, ready, color, trail, joined_at)
     VALUES (?, ?, ?, 1200, ?, ?, ?, 1, 0, ?, '[]', ?)`
  ).bind(room.id, user.id, user.username, pos.x, pos.y, pos.dir, color, now).run();

  await db.prepare(
    'UPDATE tron_rooms SET expires_at = ? WHERE id = ?'
  ).bind(now + ROOM_EXPIRY_SECONDS, room.id).run();

  return json({ roomId: room.id, code: room.code, status: room.status });
}

async function handleLeave(db, user, body, now) {
  const roomId = body && body.room ? String(body.room) : null;
  if (!roomId) return json({ error: 'Missing room' }, 400);

  const player = await db.prepare(
    'SELECT id FROM tron_players WHERE room_id = ? AND user_id = ?'
  ).bind(roomId, user.id).first();
  if (!player) return json({ error: 'Not in room' }, 404);

  await db.prepare(
    'DELETE FROM tron_players WHERE room_id = ? AND user_id = ?'
  ).bind(roomId, user.id).run();

  const remaining = await db.prepare(
    'SELECT COUNT(*) as cnt FROM tron_players WHERE room_id = ?'
  ).bind(roomId).first();

  if (remaining.cnt === 0) {
    await db.prepare('DELETE FROM tron_rooms WHERE id = ?').bind(roomId).run();
  } else {
    const hostGone = await db.prepare(
      'SELECT user_id FROM tron_players WHERE room_id = ? ORDER BY joined_at ASC LIMIT 1'
    ).bind(roomId).first();
    if (hostGone) {
      await db.prepare(
        'UPDATE tron_rooms SET host_id = ? WHERE id = ?'
      ).bind(hostGone.user_id, roomId).run();
    }
  }

  return json({ ok: true });
}

async function handleReady(db, user, body) {
  const roomId = body && body.room ? String(body.room) : null;
  if (!roomId) return json({ error: 'Missing room' }, 400);

  const player = await db.prepare(
    'SELECT ready FROM tron_players WHERE room_id = ? AND user_id = ?'
  ).bind(roomId, user.id).first();
  if (!player) return json({ error: 'Not in room' }, 404);

  const newReady = player.ready ? 0 : 1;
  await db.prepare(
    'UPDATE tron_players SET ready = ? WHERE room_id = ? AND user_id = ?'
  ).bind(newReady, roomId, user.id).run();

  return json({ ready: !!newReady });
}

async function handleStart(db, user, body, now) {
  const roomId = body && body.room ? String(body.room) : null;
  if (!roomId) return json({ error: 'Missing room' }, 400);

  const room = await db.prepare(
    'SELECT * FROM tron_rooms WHERE id = ?'
  ).bind(roomId).first();
  if (!room) return json({ error: 'Room not found' }, 404);
  if (room.host_id !== user.id) return json({ error: 'Not host' }, 403);
  if (room.status !== 'waiting') return json({ error: 'Game already started' }, 409);

  const players = await db.prepare(
    'SELECT COUNT(*) as cnt FROM tron_players WHERE room_id = ?'
  ).bind(roomId).first();
  if (players.cnt < 2) return json({ error: 'Need at least 2 players' }, 400);

  await db.prepare(
    "UPDATE tron_rooms SET status = 'playing', expires_at = ? WHERE id = ?"
  ).bind(now + ROOM_EXPIRY_SECONDS, roomId).run();

  const allPlayers = await db.prepare(
    'SELECT user_id FROM tron_players WHERE room_id = ?'
  ).bind(roomId).all();

  let idx = 0;
  for (const p of (allPlayers.results || [])) {
    const pos = START_POSITIONS[idx % START_POSITIONS.length];
    await db.prepare(
      'UPDATE tron_players SET x = ?, y = ?, dir = ?, alive = 1, trail = ? WHERE room_id = ? AND user_id = ?'
    ).bind(pos.x, pos.y, pos.dir, '[]', roomId, p.user_id).run();
    idx++;
  }

  return json({ ok: true, status: 'playing' });
}

async function findMatch(db, now) {
  const candidates = await db.prepare(
    `SELECT r.id, r.code, r.status, r.host_id,
            (SELECT COUNT(*) FROM tron_players p WHERE p.room_id = r.id) as player_count
     FROM tron_rooms r
     WHERE r.status = 'waiting' AND r.expires_at > ?
     ORDER BY player_count DESC`
  ).bind(now).all();

  for (const room of (candidates.results || [])) {
    if (room.player_count < MAX_PLAYERS) return room;
  }
  return null;
}
