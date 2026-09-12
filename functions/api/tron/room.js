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
  { x: 0,        y: 0,        dir: 'right' },
  { x: GRID_W-1, y: 0,        dir: 'left'  },
  { x: 0,        y: GRID_H-1, dir: 'right' },
  { x: GRID_W-1, y: GRID_H-1, dir: 'left'  },
  { x: Math.floor(GRID_W/2), y: 0,        dir: 'down'  },
  { x: Math.floor(GRID_W/2), y: GRID_H-1, dir: 'up'    },
  { x: 0,        y: Math.floor(GRID_H/2), dir: 'right' },
  { x: GRID_W-1, y: Math.floor(GRID_H/2), dir: 'left'  },
];

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function findRoomByCode(db, code) {
  return db.prepare('SELECT * FROM tron_rooms WHERE code = ?').bind(code).first();
}

async function getPlayerCount(db, roomId) {
  const r = await db.prepare('SELECT COUNT(*) as cnt FROM tron_players WHERE room_id = ?').bind(roomId).first();
  return r ? r.cnt : 0;
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
  return json({ error: 'Unknown action' }, 400);
}

async function handleCreate(db, user, body, now) {
  const existing = await db.prepare('SELECT room_id FROM tron_players WHERE user_id = ?').bind(user.id).first();
  if (existing) {
    await db.prepare('DELETE FROM tron_players WHERE room_id = ? AND user_id = ?').bind(existing.room_id, user.id).run();
  }

  const roomId = crypto.randomUUID();
  const code = generateCode();
  const maxPlayers = [2, 4, 6, 8].includes(Number(body?.maxPlayers)) ? Number(body.maxPlayers) : 8;
  const speed = ['slow', 'medium', 'fast'].includes(body?.speed) ? body.speed : 'medium';
  const expiresAt = now + ROOM_EXPIRY_SECONDS;

  await db.prepare(
    `INSERT INTO tron_rooms (id, code, status, host_id, max_players, speed, created_at, expires_at)
     VALUES (?, ?, 'waiting', ?, ?, ?, ?, ?)`
  ).bind(roomId, code, user.id, maxPlayers, speed, now, expiresAt).run();

  const pos = START_POSITIONS[0];
  await db.prepare(
    `INSERT INTO tron_players (room_id, user_id, username, rating, x, y, dir, alive, ready, color, trail, joined_at)
     VALUES (?, ?, ?, 1200, ?, ?, ?, 1, 0, ?, '[]', ?)`
  ).bind(roomId, user.id, user.username, pos.x, pos.y, pos.dir, COLORS[0], now).run();

  return json({ code, status: 'waiting', playerIndex: 0 });
}

async function handleJoin(db, user, body, now) {
  const inRoom = await db.prepare('SELECT room_id FROM tron_players WHERE user_id = ?').bind(user.id).first();
  if (inRoom) {
    await db.prepare('DELETE FROM tron_players WHERE room_id = ? AND user_id = ?').bind(inRoom.room_id, user.id).run();
  }

  const code = body && body.code ? String(body.code).toUpperCase() : null;
  let room;

  if (code) {
    room = await db.prepare("SELECT * FROM tron_rooms WHERE code = ? AND status = 'waiting'").bind(code).first();
    if (!room) return json({ error: 'Room not found or already started' }, 404);
  } else {
    room = await findMatch(db, now);
    if (!room) {
      const roomId = crypto.randomUUID();
      const roomCode = generateCode();
      const expiresAt = now + ROOM_EXPIRY_SECONDS;
      await db.prepare(
        `INSERT INTO tron_rooms (id, code, status, host_id, created_at, expires_at)
         VALUES (?, ?, 'waiting', ?, ?, ?)`
      ).bind(roomId, roomCode, user.id, now, expiresAt).run();
      room = { id: roomId, code: roomCode, status: 'waiting', host_id: user.id, max_players: 8, speed: 'medium' };
    }
  }

  const playerCount = await getPlayerCount(db, room.id);
  if (playerCount >= (room.max_players || MAX_PLAYERS)) return json({ error: 'Room is full' }, 409);

  const pos = START_POSITIONS[playerCount % START_POSITIONS.length];
  const color = COLORS[playerCount % COLORS.length];

  await db.prepare(
    `INSERT INTO tron_players (room_id, user_id, username, rating, x, y, dir, alive, ready, color, trail, joined_at)
     VALUES (?, ?, ?, 1200, ?, ?, ?, 1, 0, ?, '[]', ?)`
  ).bind(room.id, user.id, user.username, pos.x, pos.y, pos.dir, color, now).run();

  await db.prepare('UPDATE tron_rooms SET expires_at = ? WHERE id = ?').bind(now + ROOM_EXPIRY_SECONDS, room.id).run();

  return json({ code: room.code, maxPlayers: room.max_players, speed: room.speed, status: room.status, playerIndex: playerCount, hostId: room.host_id });
}

async function handleLeave(db, user, body) {
  const code = body && body.code ? String(body.code).toUpperCase() : null;
  if (!code) return json({ error: 'Missing code' }, 400);

  const room = await findRoomByCode(db, code);
  if (!room) return json({ error: 'Room not found' }, 404);

  await db.prepare('DELETE FROM tron_players WHERE room_id = ? AND user_id = ?').bind(room.id, user.id).run();

  const remaining = await getPlayerCount(db, room.id);
  if (remaining === 0) {
    await db.prepare('DELETE FROM tron_rooms WHERE id = ?').bind(room.id).run();
  } else {
    const hostGone = await db.prepare(
      'SELECT user_id FROM tron_players WHERE room_id = ? ORDER BY joined_at ASC LIMIT 1'
    ).bind(room.id).first();
    if (hostGone) {
      await db.prepare('UPDATE tron_rooms SET host_id = ? WHERE id = ?').bind(hostGone.user_id, room.id).run();
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
    'SELECT ready FROM tron_players WHERE room_id = ? AND user_id = ?'
  ).bind(room.id, user.id).first();
  if (!player) return json({ error: 'Not in room' }, 404);

  const newReady = player.ready ? 0 : 1;
  await db.prepare(
    'UPDATE tron_players SET ready = ? WHERE room_id = ? AND user_id = ?'
  ).bind(newReady, room.id, user.id).run();

  return json({ ok: true, ready: !!newReady });
}

async function handleStart(db, user, body, now) {
  const code = body && body.code ? String(body.code).toUpperCase() : null;
  if (!code) return json({ error: 'Missing code' }, 400);

  const room = await findRoomByCode(db, code);
  if (!room) return json({ error: 'Room not found' }, 404);
  if (Number(room.host_id) !== Number(user.id)) return json({ error: 'Not host' }, 403);
  if (room.status !== 'waiting') return json({ error: 'Game already started' }, 409);

  const playerCount = await getPlayerCount(db, room.id);
  if (playerCount < 2) return json({ error: 'Need at least 2 players' }, 400);

  await db.prepare("UPDATE tron_rooms SET status = 'playing', expires_at = ? WHERE id = ?").bind(now + ROOM_EXPIRY_SECONDS, room.id).run();

  const allPlayers = await db.prepare('SELECT user_id FROM tron_players WHERE room_id = ?').bind(room.id).all();

  let idx = 0;
  for (const p of (allPlayers.results || [])) {
    const pos = START_POSITIONS[idx % START_POSITIONS.length];
    await db.prepare(
      'UPDATE tron_players SET x = ?, y = ?, dir = ?, alive = 1, trail = ? WHERE room_id = ? AND user_id = ?'
    ).bind(pos.x, pos.y, pos.dir, '[]', room.id, p.user_id).run();
    idx++;
  }

  return json({ ok: true, status: 'playing' });
}

async function findMatch(db, now) {
  const candidates = await db.prepare(
    `SELECT r.id, r.code, r.status, r.host_id, r.max_players, r.speed,
            (SELECT COUNT(*) FROM tron_players p WHERE p.room_id = r.id) as player_count
     FROM tron_rooms r
     WHERE r.status = 'waiting' AND r.expires_at > ?
     ORDER BY player_count DESC`
  ).bind(now).all();

  for (const room of (candidates.results || [])) {
    if (room.player_count < (room.max_players || MAX_PLAYERS)) return room;
  }
  return null;
}
