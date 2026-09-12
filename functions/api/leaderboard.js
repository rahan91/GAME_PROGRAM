import { json } from '../_lib/auth.js';
import { attachNameplates } from '../_lib/nameplates.js';

const GAMES = { maze: 'total', target: 'total', button: 'best', cut: 'total', circle: 'total', pong: 'total', tron: 'total' };

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 20;
  const game = String(url.searchParams.get('game') || '').toLowerCase();
  const metric = String(url.searchParams.get('metric') || 'total').toLowerCase();

  // Universal board (legacy behaviour): combined total across all games.
  if (!GAMES[game]) {
    const rows = await context.env.DATABASE.prepare(
      'SELECT user_id AS id, username, total FROM scores WHERE total > 0 ORDER BY total DESC, updated_at ASC LIMIT ?'
    ).bind(limit).all();
    return json({ leaderboard: await attachNameplates(context.env, rows.results) });
  }

  const col = metric === 'best' ? 'best' : 'total';
  const rows = await context.env.DATABASE.prepare(
    `SELECT user_id AS id, username, ${col} AS value
       FROM game_stats
      WHERE game = ? AND ${col} > 0
      ORDER BY ${col} DESC, updated_at ASC
      LIMIT ?`
  ).bind(game, limit).all();

  return json({ game, metric: col, leaderboard: await attachNameplates(context.env, rows.results) });
}