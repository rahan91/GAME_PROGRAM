import { json, getUserFromRequest } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ user: null });
  const row = await context.env.DATABASE.prepare(
    'SELECT total, plays, spent FROM scores WHERE user_id = ?'
  ).bind(user.id).first();
  const total = row ? row.total : 0;
  const spent = row ? row.spent : 0;
  return json({
    user: {
      ...user,
      total,
      plays: row ? row.plays : 0,
      spent,
      balance: total - spent,
    },
  });
}
