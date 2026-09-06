import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';

export async function onRequestPost(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const username = String((body && body.username) || '').trim();
  if (!username) return json({ error: 'Username required' }, 400);
  if (username.toLowerCase() === 'ruruskaado') return json({ error: 'Cannot strip items from admin' }, 400);

  const target = await context.env.DATABASE.prepare(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?)'
  ).bind(username).first();
  if (!target) return json({ error: 'No such user' }, 404);

  const results = await context.env.DATABASE.batch([
    context.env.DATABASE.prepare('DELETE FROM equips WHERE user_id = ?').bind(target.id),
    context.env.DATABASE.prepare('DELETE FROM purchases WHERE user_id = ?').bind(target.id),
  ]);

  const equipsCleared = results[0].meta.changes;
  const itemsRemoved = results[1].meta.changes;

  return json({ username, items_removed: itemsRemoved, equips_cleared: equipsCleared });
}