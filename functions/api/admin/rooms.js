import { json } from '../../_lib/auth.js';
import { getAdminUser } from '../../_lib/admin.js';

export async function onRequestGet(context) {
  const admin = await getAdminUser(context.env, context.request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  const now = Math.floor(Date.now() / 1000);
  const pongRooms = await context.env.DATABASE.prepare(
    `SELECT r.id, r.code, r.mode, r.status, r.max_players, r.speed, r.rounds_target,
            r.room_name, r.is_private, r.min_players, r.round_num, r.created_at,
            (SELECT COUNT(*) FROM pong_players p WHERE p.room_id = r.id) AS player_count
       FROM pong_rooms r
      WHERE r.status IN ('waiting', 'playing')
        AND r.expires_at > ?
      ORDER BY r.created_at DESC`
  ).bind(now).all();

  const tronRooms = await context.env.DATABASE.prepare(
    `SELECT r.id, r.code, r.status, r.max_players, r.speed,
            r.room_name, r.is_private, r.min_players, r.created_at,
            (SELECT COUNT(*) FROM tron_players p WHERE p.room_id = r.id) AS player_count
       FROM tron_rooms r
      WHERE r.status IN ('waiting', 'playing')
        AND r.expires_at > ?
      ORDER BY r.created_at DESC`
  ).bind(now).all();

  const gameStats = await context.env.DATABASE.prepare(
    `SELECT (SELECT COUNT(*) FROM game_plays WHERE game = 'maze') AS maze,
            (SELECT COUNT(*) FROM game_plays WHERE game = 'target') AS target,
            (SELECT COUNT(*) FROM game_plays WHERE game = 'button') AS button,
            (SELECT COUNT(*) FROM game_plays WHERE game = 'cut') AS cut,
            (SELECT COUNT(*) FROM game_plays WHERE game = 'circle') AS circle,
            (SELECT COUNT(*) FROM game_plays WHERE game = 'pong') AS pong,
            (SELECT COUNT(*) FROM game_plays WHERE game = 'tron') AS tron`
  ).first();

  return json({
    pongRooms: pongRooms.results || [],
    tronRooms: tronRooms.results || [],
    gameStats: gameStats || {}
  });
}
