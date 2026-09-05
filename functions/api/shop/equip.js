import { json, getUserFromRequest } from '../../_lib/auth.js';
import { getItem, SLOTS } from '../../_lib/catalog.js';

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const slot = String((body && body.slot) || '');
  const itemKey = body && body.item_key ? String(body.item_key) : null;
  if (!SLOTS.includes(slot)) return json({ error: 'Invalid slot' }, 400);

  if (itemKey) {
    const item = getItem(itemKey);
    if (!item || item.slot !== slot) return json({ error: 'Invalid item' }, 400);
    const owned = await context.env.DATABASE.prepare(
      'SELECT 1 FROM purchases WHERE user_id = ? AND item_key = ?'
    ).bind(user.id, itemKey).first();
    if (!item.default && !owned) return json({ error: 'You do not own this item' }, 400);
    await context.env.DATABASE.prepare(
      `INSERT INTO equips (user_id, slot, item_key) VALUES (?, ?, ?)
       ON CONFLICT(user_id, slot) DO UPDATE SET item_key = excluded.item_key`
    ).bind(user.id, slot, itemKey).run();
  } else {
    await context.env.DATABASE.prepare(
      'DELETE FROM equips WHERE user_id = ? AND slot = ?'
    ).bind(user.id, slot).run();
  }

  return json({ slot, item_key: itemKey });
}