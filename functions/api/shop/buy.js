import { json, getUserFromRequest } from '../../_lib/auth.js';
import { getItem } from '../../_lib/catalog.js';

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const item = getItem(String((body && body.item_key) || ''));
  if (!item) return json({ error: 'Unknown item' }, 400);

  const scores = await context.env.DATABASE.prepare(
    'SELECT total, spent FROM scores WHERE user_id = ?'
  ).bind(user.id).first();
  const total = scores ? scores.total : 0;
  const spent = scores ? scores.spent : 0;
  const balance = total - spent;

  const owned = await context.env.DATABASE.prepare(
    'SELECT 1 FROM purchases WHERE user_id = ? AND item_key = ?'
  ).bind(user.id, item.key).first();
  if (owned) return json({ error: 'Already owned' }, 400);
  if (balance < item.price) return json({ error: 'Not enough points' }, 400);

  await context.env.DATABASE.batch([
    context.env.DATABASE.prepare(
      'INSERT INTO purchases (user_id, item_key, bought_at) VALUES (?, ?, unixepoch())'
    ).bind(user.id, item.key),
    context.env.DATABASE.prepare(
      'UPDATE scores SET spent = spent + ? WHERE user_id = ?'
    ).bind(item.price, user.id),
  ]);

  const row = await context.env.DATABASE.prepare(
    'SELECT total, spent FROM scores WHERE user_id = ?'
  ).bind(user.id).first();
  const ownedRows = await context.env.DATABASE.prepare(
    'SELECT item_key FROM purchases WHERE user_id = ?'
  ).bind(user.id).all();

  return json({
    item: item.key,
    balance: row.total - row.spent,
    spent: row.spent,
    owned: (ownedRows.results || []).map((r) => r.item_key),
  });
}