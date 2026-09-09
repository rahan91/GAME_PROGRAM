import { json } from '../../_lib/auth.js';
import { attachNameplates } from '../../_lib/nameplates.js';

const DIFFICULTIES = { easy: 1, normal: 1, hard: 1, harder: 1, insane: 1 };
const BEST = `
  WITH bests AS (
    SELECT user_id AS id, username,
           MAX(accuracy) AS accuracy,
           MAX(points) AS points,
           MIN(elapsed) AS elapsed
    FROM cut_runs
    WHERE difficulty = ?
    GROUP BY user_id, username
  )`;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const difficulty = String(url.searchParams.get('difficulty') || '').toLowerCase();
  if (!DIFFICULTIES[difficulty]) return json({ error: 'Invalid difficulty' }, 400);

  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 10;
  const user = String(url.searchParams.get('user') || '').trim();

  const stats = await context.env.DATABASE.prepare(
    'SELECT COUNT(*) AS runs, COUNT(DISTINCT user_id) AS players FROM cut_runs WHERE difficulty = ?'
  ).bind(difficulty).first();

  const top = await context.env.DATABASE.prepare(
    BEST + ' SELECT id, username, accuracy, points, elapsed FROM bests ORDER BY accuracy DESC, points DESC, elapsed ASC LIMIT ?'
  ).bind(difficulty, limit).all();
  await attachNameplates(context.env, top.results);

  let userStats = null;
  if (user) {
    const best = await context.env.DATABASE.prepare(
      BEST + ' SELECT id, username, accuracy, points FROM bests WHERE username = ?'
    ).bind(difficulty, user).first();

    if (best) {
      const counts = await context.env.DATABASE.prepare(
        BEST + ` SELECT
          (SELECT COUNT(*) FROM bests WHERE accuracy < ?) AS below,
          (SELECT COUNT(*) FROM bests WHERE accuracy = ?) AS ties,
          (SELECT COUNT(*) FROM bests) AS total`
      ).bind(difficulty, best.accuracy, best.accuracy).first();

      const total = counts.total || 0;
      const below = counts.below || 0;
      const ties = counts.ties || 0;
      const pct = total ? (below + 0.5 * ties) / total * 100 : null;
      const runs = await context.env.DATABASE.prepare(
        'SELECT COUNT(*) AS n FROM cut_runs WHERE difficulty = ? AND user_id = ?'
      ).bind(difficulty, best.id).first();

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
    difficulty,
    runs: stats ? stats.runs : 0,
    players: stats ? stats.players : 0,
    top: top.results,
    user: userStats,
  });
}