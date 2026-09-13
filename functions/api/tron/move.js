import { json, getUserFromRequest } from '../../_lib/auth.js';

const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const code = body && body.room ? String(body.room).toUpperCase() : null;
  const dir = body && body.dir ? String(body.dir).toLowerCase() : null;
  const aiId = body && body.aiId ? String(body.aiId) : null;

  if (!code) return json({ error: 'Missing room' }, 400);
  if (!dir || !VALID_DIRS.has(dir)) {
    return json({ error: 'dir must be up, down, left, or right' }, 400);
  }

  const db = context.env.DATABASE;

  const room = await db.prepare(
    'SELECT id, status, host_id FROM tron_rooms WHERE code = ?'
  ).bind(code).first();
  if (!room) return json({ error: 'Room not found' }, 404);
  if (room.status !== 'playing') return json({ error: 'Game not in progress' }, 409);

  if (aiId) {
    if (String(room.host_id) !== String(user.id)) return json({ error: 'Only host can control AI' }, 403);
    const player = await db.prepare(
      'SELECT id, dir FROM tron_players WHERE room_id = ? AND user_id = ?'
    ).bind(room.id, aiId).first();
    if (!player) return json({ error: 'AI player not found' }, 404);
    if (player.dir === OPPOSITE[dir]) return json({ error: 'Cannot reverse direction' }, 400);
    await db.prepare(
      'UPDATE tron_players SET dir = ? WHERE room_id = ? AND user_id = ?'
    ).bind(dir, room.id, aiId).run();
  } else {
    const player = await db.prepare(
      'SELECT dir FROM tron_players WHERE room_id = ? AND user_id = ?'
    ).bind(room.id, user.id).first();
    if (!player) return json({ error: 'Not in room' }, 403);
    if (player.dir === OPPOSITE[dir]) return json({ error: 'Cannot reverse direction' }, 400);
    await db.prepare(
      'UPDATE tron_players SET dir = ? WHERE room_id = ? AND user_id = ?'
    ).bind(dir, room.id, user.id).run();
  }

  return json({ ok: true, dir });
}
