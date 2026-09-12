import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const roomId = body && body.room ? String(body.room) : null;
  const dir = body && body.dir !== undefined ? Number(body.dir) : null;

  if (!roomId) return json({ error: 'Missing room' }, 400);
  if (dir === null || !Number.isInteger(dir) || dir < -1 || dir > 1) {
    return json({ error: 'dir must be -1, 0, or 1' }, 400);
  }

  const db = context.env.DATABASE;

  const room = await db.prepare(
    'SELECT status FROM pong_rooms WHERE id = ?'
  ).bind(roomId).first();
  if (!room) return json({ error: 'Room not found' }, 404);
  if (room.status !== 'playing') return json({ error: 'Game not in progress' }, 409);

  const player = await db.prepare(
    'SELECT id FROM pong_players WHERE room_id = ? AND user_id = ?'
  ).bind(roomId, user.id).first();
  if (!player) return json({ error: 'Not in room' }, 403);

  await db.prepare(
    'UPDATE pong_players SET dir = ? WHERE room_id = ? AND user_id = ?'
  ).bind(dir, roomId, user.id).run();

  return json({ ok: true, dir });
}
