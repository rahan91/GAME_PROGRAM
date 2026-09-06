import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';

const FIELDS = ['total', 'spent', 'plays'];

export async function onRequestPost(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const username = String((body && body.username) || '').trim();
  const field = String((body && body.field) || 'total');
  const delta = Math.round(Number(body && body.delta));
  if (!username) return json({ error: 'username is required' }, 400);
  if (!FIELDS.includes(field)) return json({ error: 'field must be total, spent, or plays' }, 400);
  if (!Number.isFinite(delta)) return json({ error: 'delta must be a number' }, 400);

  const user = await context.env.DATABASE.prepare(
    'SELECT id, username FROM users WHERE username = ?'
  ).bind(username).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const row = await context.env.DATABASE.prepare(
    'SELECT total, spent, plays FROM scores WHERE user_id = ?'
  ).bind(user.id).first();

  const current = row ? (row[field] || 0) : 0;
  const next = Math.max(0, current + delta);

  if (!row) {
    const insertField = field === 'total' ? 'total' : field;
    await context.env.DATABASE.prepare(
      'INSERT INTO scores (user_id, username, total, spent, plays) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, user.username, field === 'total' ? next : 0, field === 'spent' ? next : 0, field === 'plays' ? next : 0).run();
  } else if (next !== current) {
    await context.env.DATABASE.prepare(
      `UPDATE scores SET ${field} = ?, updated_at = unixepoch() WHERE user_id = ?`
    ).bind(next, user.id).run();
  }

  const updated = await context.env.DATABASE.prepare(
    'SELECT total, spent, plays FROM scores WHERE user_id = ?'
  ).bind(user.id).first();

  return json({
    username,
    field,
    delta,
    total: updated ? updated.total : 0,
    spent: updated ? updated.spent : 0,
    plays: updated ? updated.plays : 0,
    balance: updated ? updated.total - updated.spent : 0,
  });
}