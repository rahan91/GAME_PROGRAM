import { json } from '../../_lib/auth.js';
import { attachNameplates } from '../../_lib/nameplates.js';

const BEST = `
  WITH bests AS (
    SELECT user_id AS id, username,
           MAX(accuracy) AS accuracy,
           MAX(points) AS points,
           MIN(elapsed) AS elapsed
    FROM circle_runs
    GROUP BY user_id, username
  )`;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 10;
  const player = String(url.searchParams.get('user') || '').trim();

  const stats = await context.env.DATABASE.prepare(
    'SELECT COUNT(*) AS runs, COUNT(DISTINCT user_id) AS players FROM circle_runs'
  ).first();

  const top = await context.env.DATABASE.prepare(
    BEST + ' SELECT id, username, accuracy, points, elapsed FROM bests ORDER BY accuracy DESC, points DESC, elapsed ASC LIMIT ?'
  ).bind(limit).all();
  await attachNameplates(context.env, top.results);

  let userStats = null;
  if (player) {
    const best = await context.env.DATABASE.prepare(
      BEST + ' SELECT id, username, accuracy, points FROM bests WHERE username = ?'
    ).bind(player).first();

    if (best) {
      const counts = await context.env.DATABASE.prepare(
        BEST + ` SELECT
          (SELECT COUNT(*) FROM bests WHERE accuracy < ?) AS below,
          (SELECT COUNT(*) FROM bests WHERE accuracy = ?) AS ties,
          (SELECT COUNT(*) FROM bests) AS total`
      ).bind(best.accuracy, best.accuracy).first();

      const total = counts.total || 0;
      const below = counts.below || 0;
      const ties = counts.ties || 0;
      const pct = total ? (below + 0.5 * ties) / total * 100 : null;
      const runs = await context.env.DATABASE.prepare(
        'SELECT COUNT(*) AS n FROM circle_runs WHERE user_id = ?'
      ).bind(best.id).first();

      userStats = {
        username: best.username,
        best: best.accuracy,
        bestPoints: best.points || 0,
        runs: runs ? runs.n : 0,
        rank: below + 1,
        pct,
      };
    }
  }

  return json({
    runs: stats ? stats.runs : 0,
    players: stats ? stats.players : 0,
    top: top.results,
    user: userStats,
  });
}