import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const confirm = body && body.confirm;
  if (confirm !== 'DELETE MY ACCOUNT') return json({ error: 'Confirmation failed' }, 400);

  const password = body && body.password;
  if (!password) return json({ error: 'Password required' }, 400);

  const stored = await context.env.DATABASE.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
  if (!stored) return json({ error: 'User not found' }, 404);

  const bcrypt = await import('bcryptjs');
  const valid = await bcrypt.compare(password, stored.password_hash);
  if (!valid) return json({ error: 'Incorrect password' }, 403);

  const db = context.env.DATABASE;
  await db.prepare('DELETE FROM purchases WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM equips WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM scores WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM game_stats WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM cut_runs WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM circle_runs WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM elo_ratings WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM pong_players WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM tron_players WHERE user_id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  return json({ ok: true });
}
