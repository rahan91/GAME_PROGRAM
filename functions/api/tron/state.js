import { json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('room');
  if (!code) return json({ error: 'Missing room parameter' }, 400);

  const db = context.env.DATABASE;

  const room = await db.prepare(
    'SELECT id, code, status, host_id FROM tron_rooms WHERE code = ?'
  ).bind(code.toUpperCase()).first();
  if (!room) return json({ error: 'Room not found' }, 404);

  const players = await db.prepare(
    `SELECT id, user_id, username, rating, x, y, dir, alive, ready, color, trail
     FROM tron_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();

  let winner = null;
  if (room.status === 'finished') {
    const finished = await db.prepare('SELECT winner_id FROM tron_rooms WHERE id = ?').bind(room.id).first();
    winner = finished ? finished.winner_id : null;
  }

  return json({
    room: { id: room.id, code: room.code, status: room.status, hostId: room.host_id },
    players: (players.results || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      username: p.username,
      rating: p.rating,
      x: p.x,
      y: p.y,
      dir: p.dir,
      alive: !!p.alive,
      ready: !!p.ready,
      color: p.color,
      trail: p.trail ? JSON.parse(p.trail) : [],
    })),
    winner,
  });
}
