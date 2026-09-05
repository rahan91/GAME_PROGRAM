import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ user: null });

  const scores = await context.env.DATABASE.prepare(
    'SELECT total, spent FROM scores WHERE user_id = ?'
  ).bind(user.id).first();
  const ownedRows = await context.env.DATABASE.prepare(
    'SELECT item_key FROM purchases WHERE user_id = ?'
  ).bind(user.id).all();
  const equipRows = await context.env.DATABASE.prepare(
    'SELECT slot, item_key FROM equips WHERE user_id = ?'
  ).bind(user.id).all();

  const total = scores ? scores.total : 0;
  const spent = scores ? scores.spent : 0;
  const owned = (ownedRows.results || []).map((r) => r.item_key);
  const equipped = {};
  for (const r of (equipRows.results || [])) equipped[r.slot] = r.item_key;

  return json({
    user: { username: user.username, total, spent, balance: total - spent },
    owned,
    equipped,
  });
}