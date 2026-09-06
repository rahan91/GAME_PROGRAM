import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';

export async function onRequestGet(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  const rows = await context.env.DATABASE.prepare(
    `SELECT u.id, u.username, u.created_at,
            COALESCE(s.total, 0) AS total,
            COALESCE(s.spent, 0) AS spent,
            COALESCE(s.total, 0) - COALESCE(s.spent, 0) AS balance,
            COALESCE(s.plays, 0) AS plays,
            (SELECT COUNT(*) FROM purchases p WHERE p.user_id = u.id) AS items
       FROM users u
       LEFT JOIN scores s ON s.user_id = u.id
      ORDER BY COALESCE(s.total, 0) DESC, u.username ASC`
  ).all();

  const stats = await context.env.DATABASE.prepare(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COALESCE(SUM(total), 0) FROM scores) AS score_pool,
            (SELECT COALESCE(SUM(spent), 0) FROM scores) AS spent_pool,
            (SELECT COUNT(*) FROM purchases) AS purchases`
  ).first();

  return json({ admin: { id: admin.id, username: admin.username }, users: rows.results, stats });
}