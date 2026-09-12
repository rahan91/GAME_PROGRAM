import { json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const roomId = url.searchParams.get('room');
  if (!roomId) return json({ error: 'Missing room parameter' }, 400);

  const db = context.env.DATABASE;

  const room = await db.prepare(
    'SELECT id, code, status FROM tron_rooms WHERE id = ?'
  ).bind(roomId).first();
  if (!room) return json({ error: 'Room not found' }, 404);

  const players = await db.prepare(
    `SELECT id, username, rating, x, y, dir, alive, color, trail
     FROM tron_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(roomId).all();

  let winner = null;

  if (room.status === 'finished') {
    const finished = await db.prepare(
      'SELECT winner_id FROM tron_rooms WHERE id = ?'
    ).bind(roomId).first();
    winner = finished ? finished.winner_id : null;
  }

  return json({
    room: { id: room.id, code: room.code, status: room.status },
    players: (players.results || []).map((p) => ({
      id: p.id,
      username: p.username,
      rating: p.rating,
      x: p.x,
      y: p.y,
      dir: p.dir,
      alive: !!p.alive,
      color: p.color,
      trail: p.trail ? JSON.parse(p.trail) : [],
    })),
    winner,
  });
}
