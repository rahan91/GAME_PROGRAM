import { json, getUserFromRequest } from '../_lib/auth.js';

const MAX_POINTS = 100000;

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let points;
  try {
    const body = await context.request.json();
    points = Number(body && body.points);
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  if (!Number.isFinite(points)) return json({ error: 'Points must be a number' }, 400);
  points = Math.max(0, Math.min(MAX_POINTS, Math.round(points)));

  const now = Math.floor(Date.now() / 1000);
  await context.env.DATABASE.prepare(
    `INSERT INTO scores (user_id, username, total, plays, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       total = total + excluded.total,
       plays = plays + 1,
       updated_at = excluded.updated_at`
  ).bind(user.id, user.username, points, now).run();

  const row = await context.env.DATABASE.prepare(
    'SELECT total, plays FROM scores WHERE user_id = ?'
  ).bind(user.id).first();

  return json({ total: row.total, plays: row.plays });
}