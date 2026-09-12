import { json, getUserFromRequest } from '../../_lib/auth.js';

function calculateElo(ratingA, ratingB, scoreA, kFactor) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return {
    newA: Math.round(ratingA + kFactor * (scoreA - expectedA)),
    newB: Math.round(ratingB + kFactor * ((1 - scoreA) - (1 - expectedA))),
  };
}

function getKFactor(gamesPlayed) {
  if (gamesPlayed < 10) return 50;
  if (gamesPlayed < 30) return 40;
  return 32;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const roomId = body && body.room ? String(body.room) : null;
  const winnerId = body && body.winner_id ? String(body.winner_id) : null;
  const players = body && Array.isArray(body.players) ? body.players : [];

  if (!roomId) return json({ error: 'Missing room' }, 400);
  if (!winnerId) return json({ error: 'Missing winner_id' }, 400);
  if (players.length < 2) return json({ error: 'Need at least 2 players' }, 400);

  const db = context.env.DATABASE;
  const now = new Date().toISOString();
  const playerCount = players.length;
  const basePoints = 20 + playerCount * 5;

  const ratingChanges = {};

  const eloEntries = await db.prepare(
    `SELECT user_id, rating, games_played, wins, losses, is_provisional
     FROM elo_ratings WHERE game = 'pong' AND user_id IN (${players.map(() => '?').join(',')})`
  ).bind(...players).all();

  const ratings = {};
  for (const row of (eloEntries.results || [])) {
    ratings[row.user_id] = row;
  }

  const winnerRating = ratings[winnerId] ? ratings[winnerId].rating : 1200;
  const winnerGames = ratings[winnerId] ? ratings[winnerId].games_played : 0;
  const winnerK = getKFactor(winnerGames);

  const opponentIds = players.filter((p) => p !== winnerId);
  const avgOpponentRating = opponentIds.length > 0
    ? opponentIds.reduce((sum, id) => sum + (ratings[id] ? ratings[id].rating : 1200), 0) / opponentIds.length
    : 1200;

  const ratingFactor = clamp(1 + (avgOpponentRating - winnerRating) / 1000, 0.5, 2.0);
  const winnerPoints = Math.round(basePoints * ratingFactor);

  for (const pid of players) {
    const r = ratings[pid] ? ratings[pid].rating : 1200;
    const gp = ratings[pid] ? ratings[pid].games_played : 0;
    const w = ratings[pid] ? ratings[pid].wins : 0;
    const l = ratings[pid] ? ratings[pid].losses : 0;
    const prov = ratings[pid] ? ratings[pid].is_provisional : 1;

    const isWinner = pid === winnerId;
    const scoreA = isWinner ? 1 : 0;
    const opponentRatings = players
      .filter((p) => p !== pid)
      .map((p) => (ratings[p] ? ratings[p].rating : 1200));
    const avgOpp = opponentRatings.length > 0
      ? opponentRatings.reduce((a, b) => a + b, 0) / opponentRatings.length
      : 1200;

    const k = getKFactor(gp);
    const oppScore = isWinner ? 0 : 1;
    const expected = 1 / (1 + Math.pow(10, (avgOpp - r) / 400));
    const newRating = Math.round(r + k * (scoreA - expected));

    const rf = clamp(1 + (avgOpp - r) / 1000, 0.5, 2.0);
    const points = isWinner ? Math.round(basePoints * rf) : Math.round(basePoints * 0.2);

    ratingChanges[pid] = { old: r, new: newRating, points, isWinner };

    const newGp = gp + 1;
    const newWins = w + (isWinner ? 1 : 0);
    const newLosses = l + (isWinner ? 0 : 1);
    const newProv = newGp >= 5 ? 0 : prov;

    await db.prepare(
      `INSERT INTO elo_ratings (user_id, game, rating, games_played, wins, losses, is_provisional, last_active)
       VALUES (?, 'pong', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, game) DO UPDATE SET
         rating = excluded.rating,
         games_played = excluded.games_played,
         wins = excluded.wins,
         losses = excluded.losses,
         is_provisional = excluded.is_provisional,
         last_active = excluded.last_active`
    ).bind(pid, newRating, newGp, newWins, newLosses, newProv, now).run();

    if (points > 0) {
      await db.prepare(
        `INSERT INTO scores (user_id, username, total, plays, updated_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           total = total + excluded.total,
           plays = plays + 1,
           updated_at = excluded.updated_at`
      ).bind(pid, '', points, Math.floor(Date.now() / 1000)).run();
    }
  }

  await db.prepare(
    `INSERT INTO elo_matches (game, room_id, winner_id, players, rating_changes, played_at)
     VALUES ('pong', ?, ?, ?, ?, ?)`
  ).bind(roomId, winnerId, JSON.stringify(players), JSON.stringify(ratingChanges), now).run();

  return json({ ok: true, ratingChanges, basePoints, winnerPoints });
}
