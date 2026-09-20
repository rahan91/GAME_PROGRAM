import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';

export async function onRequestPost(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  const body = await context.request.json().catch(() => ({}));
  const { game, roomId } = body || {};

  if (!game || !roomId) return json({ error: 'Missing game or roomId' }, 400);
  if (!['pong', 'tron'].includes(game)) return json({ error: 'Invalid game' }, 400);

  const table = game === 'pong' ? 'pong_rooms' : 'tron_rooms';
  const playerTable = game === 'pong' ? 'pong_players' : 'tron_players';
  const ballTable = game === 'pong' ? 'pong_ball' : null;

  const room = await context.env.DATABASE.prepare(
    `SELECT id, status FROM ${table} WHERE id = ?`
  ).bind(roomId).first();

  if (!room) return json({ error: 'Room not found' }, 404);
  if (room.status === 'finished') return json({ error: 'Room already finished' }, 400);

  await context.env.DATABASE.prepare(
    `UPDATE ${table} SET status = 'finished', winner_id = NULL WHERE id = ?`
  ).bind(roomId).run();

  await context.env.DATABASE.prepare(
    `DELETE FROM ${playerTable} WHERE room_id = ?`
  ).bind(roomId).run();

  if (ballTable) {
    await context.env.DATABASE.prepare(
      `DELETE FROM ${ballTable} WHERE room_id = ?`
    ).bind(roomId).run();
  }

  return json({ ok: true, game, roomId, message: 'Room force-closed' });
}
