import { json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const roomId = url.searchParams.get('room');
  if (!roomId) return json({ error: 'Missing room parameter' }, 400);

  const db = context.env.DATABASE;

  const room = await db.prepare(
    'SELECT id, code, mode, status FROM pong_rooms WHERE id = ?'
  ).bind(roomId).first();
  if (!room) return json({ error: 'Room not found' }, 404);

  const players = await db.prepare(
    `SELECT id, username, rating, side, paddle_y, alive, ready, color
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(roomId).all();

  const ball = await db.prepare(
    'SELECT x, y, vx, vy FROM pong_ball WHERE room_id = ?'
  ).bind(roomId).first();

  const scores = { left: 0, right: 0 };
  let winner = null;

  if (room.status === 'finished') {
    const finished = await db.prepare(
      'SELECT winner_id FROM pong_rooms WHERE id = ?'
    ).bind(roomId).first();
    winner = finished ? finished.winner_id : null;
  }

  return json({
    room: { id: room.id, code: room.code, mode: room.mode, status: room.status },
    players: (players.results || []).map((p) => ({
      id: p.id,
      username: p.username,
      rating: p.rating,
      side: p.side,
      paddleY: p.paddle_y,
      alive: !!p.alive,
      ready: !!p.ready,
      color: p.color,
    })),
    ball: ball
      ? { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy }
      : { x: 0.5, y: 0.5, vx: 0.03, vy: 0.01 },
    scores,
    winner,
  });
}
