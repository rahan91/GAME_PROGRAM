import { json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const limitRaw = Number(context.request.url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 20;

  const rows = await context.env.DATABASE.prepare(
    'SELECT username, total, plays FROM scores WHERE total > 0 ORDER BY total DESC, updated_at ASC LIMIT ?'
  ).bind(limit).all();

  return json({ leaderboard: rows.results });
}