import { json, getUserFromRequest } from '../_lib/auth.js';

const MAX_POINTS = 100000;
const GAMES = { maze: 1, target: 1, button: 1, cut: 1, circle: 1 };

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const points = Math.round(Number(body && body.points));
  if (!Number.isFinite(points)) return json({ error: 'Points must be a number' }, 400);
  const clamped = Math.max(0, Math.min(MAX_POINTS, points));

  const game = String((body && body.game) || '').toLowerCase();
  const holdMs = Math.round(Number(body && body.holdMs));

  const now = Math.floor(Date.now() / 1000);
  const ops = [
    context.env.DATABASE.prepare(
      `INSERT INTO scores (user_id, username, total, plays, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         total = total + excluded.total,
         plays = plays + 1,
         updated_at = excluded.updated_at`
    ).bind(user.id, user.username, clamped, now),
  ];

  if (GAMES[game]) {
    const best = Number.isFinite(holdMs) ? Math.max(0, holdMs) : 0;
    ops.push(context.env.DATABASE.prepare(
      `INSERT INTO game_stats (user_id, username, game, total, plays, best, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(user_id, game) DO UPDATE SET
         total = total + excluded.total,
         plays = plays + 1,
         best = MAX(best, excluded.best),
         updated_at = excluded.updated_at`
    ).bind(user.id, user.username, game, clamped, best, now));
  }

  await context.env.DATABASE.batch(ops);

  const row = await context.env.DATABASE.prepare(
    'SELECT total, plays, spent FROM scores WHERE user_id = ?'
  ).bind(user.id).first();

  return json({
    total: row.total,
    plays: row.plays,
    spent: row.spent,
    balance: row.total - row.spent,
  });
}