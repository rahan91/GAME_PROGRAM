import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';

export async function onRequestPost(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const username = String((body && body.username) || '').trim();
  if (!username) return json({ error: 'username is required' }, 400);
  if (username.toLowerCase() === 'ruruskaado') return json({ error: 'Cannot delete admin' }, 400);

  const user = await context.env.DATABASE.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first();
  if (!user) return json({ error: 'User not found' }, 404);

  await context.env.DATABASE.batch([
    context.env.DATABASE.prepare('DELETE FROM purchases WHERE user_id = ?').bind(user.id),
    context.env.DATABASE.prepare('DELETE FROM equips WHERE user_id = ?').bind(user.id),
    context.env.DATABASE.prepare('DELETE FROM scores WHERE user_id = ?').bind(user.id),
    context.env.DATABASE.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    context.env.DATABASE.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);

  return json({ username, deleted: true });
}