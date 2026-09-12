import { json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 20;

  const db = context.env.DATABASE;

  const rows = await db.prepare(
    `SELECT user_id, rating, games_played, wins, losses, is_provisional
     FROM elo_ratings
     WHERE game = 'tron' AND games_played > 0
     ORDER BY rating DESC, wins DESC
     LIMIT ?`
  ).bind(limit).all();

  const leaderboard = (rows.results || []).map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    rating: r.rating,
    gamesPlayed: r.games_played,
    wins: r.wins,
    losses: r.losses,
    isProvisional: !!r.is_provisional,
    winRate: r.games_played > 0 ? Math.round((r.wins / r.games_played) * 100) : 0,
  }));

  return json({ game: 'tron', leaderboard });
}
