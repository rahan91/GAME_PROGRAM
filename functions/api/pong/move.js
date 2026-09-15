import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const code = body && body.room ? String(body.room).toUpperCase() : null;
  const dir = body && body.dir !== undefined ? Number(body.dir) : null;

  if (!code) return json({ error: 'Missing room' }, 400);
  if (dir === null || !Number.isInteger(dir) || dir < -1 || dir > 1) return json({ error: 'dir must be -1, 0, or 1' }, 400);

  const db = context.env.DATABASE;
  await db.prepare(
    "UPDATE pong_players SET dir = ? WHERE room_id = (SELECT id FROM pong_rooms WHERE code = ? AND status = 'playing') AND user_id = ?"
  ).bind(dir, code, user.id).run();

  return json({ ok: true, dir });
  } catch (e) {
    return json({ error: 'Move error' }, 500);
  }
}
