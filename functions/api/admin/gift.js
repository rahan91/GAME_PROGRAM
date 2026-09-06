import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';
import { getItem } from '../../_lib/catalog.js';

export async function onRequestPost(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const username = String((body && body.username) || '').trim();
  const item = getItem(String((body && body.item_key) || ''));
  if (!username) return json({ error: 'Username required' }, 400);
  if (!item) return json({ error: 'Unknown item' }, 400);
  if (item.default) return json({ error: 'Default items are free' }, 400);

  const target = await context.env.DATABASE.prepare(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?)'
  ).bind(username).first();
  if (!target) return json({ error: 'No such user' }, 404);

  const owned = await context.env.DATABASE.prepare(
    'SELECT 1 FROM purchases WHERE user_id = ? AND item_key = ?'
  ).bind(target.id, item.key).first();
  if (owned) return json({ error: 'Already owned by ' + username }, 400);

  await context.env.DATABASE.prepare(
    'INSERT INTO purchases (user_id, item_key, bought_at) VALUES (?, ?, unixepoch())'
  ).bind(target.id, item.key).run();

  return json({ gifted: { username, item_key: item.key }, price: item.price });
}