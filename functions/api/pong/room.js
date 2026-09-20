import { json, getUserFromRequest } from '../../_lib/auth.js';

const ROOM_EXPIRY_SECONDS = 30 * 60;
const MAX_PLAYERS = 16;
const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1',
  '#dda0dd', '#f0e68c', '#87ceeb', '#ffa07a',
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

const QUAD_SIDES = ['top', 'right', 'bottom', 'left'];

function assignSide(mode, playerCount) {
  if (mode === 'quads') {
    return QUAD_SIDES[playerCount % 4];
  }
  return playerCount % 2 === 0 ? 'left' : 'right';
}

export async function onRequestPost(context) {
  try {
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
    if (action === 'rematch') return handleRematch(db, user, body, now);
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: 'Server error: ' + (e.message || e) }, 500);
  }
}

async function handleCreate(db, user, body, now) {
  const existing = await db.prepare('SELECT room_id FROM pong_players WHERE user_id = ?').bind(user.id).first();
  if (existing) {
    await db.prepare('DELETE FROM pong_players WHERE room_id = ? AND user_id = ?').bind(existing.room_id, user.id).run();
  }

  const roomId = crypto.randomUUID();
  const code = generateCode();
  const mode = (body && body.mode === 'quads') ? 'quads' : 'teams';
  const maxPlayers = [2, 4, 6, 8, 10, 12, 14, 16].includes(Number(body?.maxPlayers)) ? Number(body.maxPlayers) : (mode === 'quads' ? 4 : 4);
  const speed = ['slow', 'medium', 'fast'].includes(body?.speed) ? body.speed : 'medium';
  const roundsTarget = [1, 3, 5, 7, 10].includes(Number(body?.rounds)) ? Number(body.rounds) : 3;
  const expiresAt = now + ROOM_EXPIRY_SECONDS;

  try {
    await db.prepare(
      `INSERT INTO pong_rooms (id, code, mode, status, host_id, max_players, speed, rounds_target, round_num, created_at, expires_at)
       VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?, 0, ?, ?)`
    ).bind(roomId, code, mode, user.id, maxPlayers, speed, roundsTarget, now, expiresAt).run();
  } catch (e) {
    await db.prepare(
      `INSERT INTO pong_rooms (id, code, mode, status, host_id, max_players, speed, created_at, expires_at)
       VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?, ?)`
    ).bind(roomId, code, mode, user.id, maxPlayers, speed, now, expiresAt).run();
  }

  const side = assignSide(mode, 0);
  await db.prepare(
    `INSERT INTO pong_players (room_id, user_id, username, rating, side, paddle_y, alive, ready, dir, color, joined_at)
     VALUES (?, ?, ?, 1200, ?, 0.5, 1, 0, 0, ?, ?)`
  ).bind(roomId, user.id, user.username, side, COLORS[0], now).run();

  return json({ code, mode, maxPlayers, speed, roundsTarget, status: 'waiting', playerIndex: 0, hostId: user.id });
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
      try {
        await db.prepare(
          `INSERT INTO pong_rooms (id, code, mode, status, host_id, rounds_target, round_num, created_at, expires_at)
           VALUES (?, ?, 'teams', 'waiting', ?, 3, 0, ?, ?)`
        ).bind(roomId, roomCode, user.id, now, expiresAt).run();
      } catch (e) {
        await db.prepare(
          `INSERT INTO pong_rooms (id, code, mode, status, host_id, created_at, expires_at)
           VALUES (?, ?, 'teams', 'waiting', ?, ?, ?)`
        ).bind(roomId, roomCode, user.id, now, expiresAt).run();
      }
      room = { id: roomId, code: roomCode, mode: 'teams', status: 'waiting', host_id: user.id, max_players: 8, speed: 'medium', rounds_target: 3 };
    }
  }

  const playerCount = await getPlayerCount(db, room.id);
  if (playerCount >= (room.max_players || MAX_PLAYERS)) return json({ error: 'Room is full' }, 409);

  const side = assignSide(room.mode, playerCount);
  const color = COLORS[playerCount % COLORS.length];

  await db.prepare(
    `INSERT INTO pong_players (room_id, user_id, username, rating, side, paddle_y, alive, ready, dir, color, joined_at)
     VALUES (?, ?, ?, 1200, ?, 0.5, 1, 0, 0, ?, ?)`
  ).bind(room.id, user.id, user.username, side, color, now).run();

  await db.prepare('UPDATE pong_rooms SET expires_at = ? WHERE id = ?').bind(now + ROOM_EXPIRY_SECONDS, room.id).run();

  const hostUser = await db.prepare('SELECT username FROM pong_players WHERE room_id = ? AND user_id = ?').bind(room.id, room.host_id).first();
  return json({ code: room.code, mode: room.mode, maxPlayers: room.max_players, speed: room.speed, roundsTarget: room.rounds_target, status: room.status, playerIndex: playerCount + 1, hostId: room.host_id, hostUsername: hostUser ? hostUser.username : null });
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
  const hostCheck = await db.prepare('SELECT 1 FROM pong_rooms WHERE id = ? AND host_id = ?').bind(room.id, user.id).first();
  if (!hostCheck) return json({ error: 'Not host' }, 403);
  if (room.status !== 'waiting') return json({ error: 'Game already started' }, 409);

  const playerCount = await getPlayerCount(db, room.id);
  if (playerCount < 2) return json({ error: 'Need at least 2 players' }, 400);

  const readyCount = await db.prepare('SELECT COUNT(*) as c FROM pong_players WHERE room_id = ? AND ready = 1').bind(room.id).first();
  if (readyCount.c < 2) return json({ error: 'Need at least 2 ready players' }, 400);

  if (room.mode === 'teams' && playerCount % 2 !== 0) return json({ error: 'Teams mode needs even number of players' }, 400);
  if (room.mode === 'quads' && playerCount % 4 !== 0) return json({ error: 'Quads mode needs players divisible by 4' }, 400);

  try {
    await db.prepare("UPDATE pong_rooms SET status = 'playing', round_num = 0, score_top = 0, score_bottom = 0, score_left = 0, score_right = 0, winner_id = NULL, last_tick_at = ?, expires_at = ? WHERE id = ?").bind(now, now + ROOM_EXPIRY_SECONDS, room.id).run();
  } catch (e) {
    await db.prepare("UPDATE pong_rooms SET status = 'playing', expires_at = ? WHERE id = ?").bind(now + ROOM_EXPIRY_SECONDS, room.id).run();
  }

  const allPlayers = await db.prepare('SELECT user_id, ready FROM pong_players WHERE room_id = ?').bind(room.id).all();
  for (const p of (allPlayers.results || [])) {
    await db.prepare('UPDATE pong_players SET paddle_y = 0.5, alive = 1, dir = 0 WHERE room_id = ? AND user_id = ?').bind(room.id, p.user_id).run();
  }

  await db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id).run();
  const spd = room.speed === 'fast' ? 8 : room.speed === 'slow' ? 3 : 5;
  const vx = room.speed === 'fast' ? 0.045 : room.speed === 'slow' ? 0.02 : 0.03;
  const angle = Math.random() * Math.PI * 2;
  const bvx = Math.cos(angle) * vx;
  const bvy = Math.sin(angle) * vx;
  await db.prepare('INSERT INTO pong_ball (room_id, x, y, vx, vy, speed) VALUES (?, 0.5, 0.5, ?, ?, ?)').bind(room.id, bvx, bvy, spd).run();

  return json({ ok: true, status: 'playing' });
}

async function handleRematch(db, user, body, now) {
  const code = body && body.code ? String(body.code).toUpperCase() : null;
  if (!code) return json({ error: 'Missing code' }, 400);

  const room = await findRoomByCode(db, code);
  if (!room) return json({ error: 'Room not found' }, 404);
  if (room.status !== 'finished') return json({ error: 'Game not finished' }, 409);

  await db.prepare("UPDATE pong_rooms SET status = 'waiting', round_num = 0, score_top = 0, score_bottom = 0, score_left = 0, score_right = 0, winner_id = NULL, expires_at = ? WHERE id = ?").bind(now + ROOM_EXPIRY_SECONDS, room.id).run();
  await db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id).run();
  await db.prepare('UPDATE pong_players SET alive = 0, ready = 0, paddle_y = 0.5, dir = 0 WHERE room_id = ?').bind(room.id).run();

  return json({ ok: true, status: 'waiting' });
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
