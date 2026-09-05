import { json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 20;

  const rows = await context.env.DATABASE.prepare(
    'SELECT user_id AS id, username, total FROM scores WHERE total > 0 ORDER BY total DESC, updated_at ASC LIMIT ?'
  ).bind(limit).all();

  return json({ leaderboard: rows.results });
}