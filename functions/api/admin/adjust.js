import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';

export async function onRequestPost(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const username = String((body && body.username) || '').trim();
  const delta = Math.round(Number(body && body.delta));
  if (!username) return json({ error: 'username is required' }, 400);
  if (!Number.isFinite(delta)) return json({ error: 'delta must be a number' }, 400);

  const user = await context.env.DATABASE.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const row = await context.env.DATABASE.prepare(
    'SELECT total FROM scores WHERE user_id = ?'
  ).bind(user.id).first();

  const next = Math.max(0, (row ? row.total : 0) + delta);
  if (!row) {
    await context.env.DATABASE.prepare(
      'INSERT INTO scores (user_id, username, total) VALUES (?, ?, ?)'
    ).bind(user.id, user.username, next).run();
  } else if (next !== row.total) {
    await context.env.DATABASE.prepare(
      'UPDATE scores SET total = ?, updated_at = unixepoch() WHERE user_id = ?'
    ).bind(next, user.id).run();
  }

  const spentRow = await context.env.DATABASE.prepare(
    'SELECT spent FROM scores WHERE user_id = ?'
  ).bind(user.id).first();

  return json({
    username,
    delta,
    total: next,
    spent: spentRow ? spentRow.spent : 0,
    balance: next - (spentRow ? spentRow.spent : 0),
  });
}