import { json, getUserFromRequest } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ user: null });
  const row = await context.env.DATABASE.prepare(
    'SELECT total, plays FROM scores WHERE user_id = ?'
  ).bind(user.id).first();
  return json({ user: { ...user, total: row ? row.total : 0, plays: row ? row.plays : 0 } });
}
