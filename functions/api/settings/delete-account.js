import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const confirm = body && body.confirm;
  if (!confirm || confirm.toLowerCase() !== user.username.toLowerCase()) {
    return json({ error: 'Username does not match' }, 400);
  }

  const db = context.env.DATABASE;

  await db.prepare('DELETE FROM purchases WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM equips WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM scores WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM game_plays WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM elo_ratings WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM pong_players WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM tron_players WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  return json({ ok: true });
}
