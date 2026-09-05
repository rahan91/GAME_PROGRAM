import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  await context.env.DATABASE.batch([
    context.env.DATABASE.prepare(
      'UPDATE scores SET total = 0, plays = 0, spent = 0, updated_at = unixepoch() WHERE user_id = ?'
    ).bind(user.id),
    context.env.DATABASE.prepare('DELETE FROM purchases WHERE user_id = ?').bind(user.id),
    context.env.DATABASE.prepare('DELETE FROM equips WHERE user_id = ?').bind(user.id),
  ]);

  return json({ total: 0, plays: 0, spent: 0, balance: 0 });
}