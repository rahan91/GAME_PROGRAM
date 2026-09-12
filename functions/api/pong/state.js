import { json } from '../../_lib/auth.js';

const PADDLE_SPEED = 0.025;
const PADDLE_HALF = 0.06;
const BALL_BASE_SPEED = 0.012;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('room');
  if (!code) return json({ error: 'Missing room parameter' }, 400);

  const db = context.env.DATABASE;

  const room = await db.prepare(
    'SELECT id, code, mode, status, host_id, max_players, speed FROM pong_rooms WHERE code = ?'
  ).bind(code.toUpperCase()).first();
  if (!room) return json({ error: 'Room not found' }, 404);

  const playerRows = await db.prepare(
    `SELECT id, username, rating, side, paddle_y, alive, ready, color, user_id, dir
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();
  const players = playerRows.results || [];

  const ballRow = await db.prepare(
    'SELECT x, y, vx, vy, speed FROM pong_ball WHERE room_id = ?'
  ).bind(room.id).first();

  if (room.status === 'playing' && ballRow && players.length >= 2) {
    const speedMul = room.speed === 'fast' ? 1.5 : room.speed === 'slow' ? 0.7 : 1;

    for (const p of players) {
      if (!p.alive) continue;
      const d = p.dir || 0;
      let newY = p.paddle_y + d * PADDLE_SPEED;
      newY = clamp(newY, PADDLE_HALF, 1 - PADDLE_HALF);
      if (newY !== p.paddle_y) {
        await db.prepare('UPDATE pong_players SET paddle_y = ? WHERE id = ?').bind(newY, p.id).run();
        p.paddle_y = newY;
      }
    }

    let bx = ballRow.x + ballRow.vx * speedMul;
    let by = ballRow.y + ballRow.vy * speedMul;
    let bvx = ballRow.vx;
    let bvy = ballRow.vy;

    if (by <= 0.01) { by = 0.01; bvy = Math.abs(bvy); }
    if (by >= 0.99) { by = 0.99; bvy = -Math.abs(bvy); }

    const alivePlayers = players.filter(p => p.alive);
    for (const p of alivePlayers) {
      const paddleTop = p.paddle_y - PADDLE_HALF;
      const paddleBot = p.paddle_y + PADDLE_HALF;
      if (by >= paddleTop && by <= paddleBot) {
        if (p.side === 'left' && bx <= 0.04 && bvx < 0) {
          bx = 0.04;
          bvx = Math.abs(bvx) * 1.02;
          const hitPos = (by - p.paddle_y) / PADDLE_HALF;
          bvy += hitPos * 0.004;
        } else if (p.side === 'right' && bx >= 0.96 && bvx > 0) {
          bx = 0.96;
          bvx = -Math.abs(bvx) * 1.02;
          const hitPos = (by - p.paddle_y) / PADDLE_HALF;
          bvy += hitPos * 0.004;
        }
      }
    }

    const baseSpd = ballRow.speed || BALL_BASE_SPEED;
    const curSpd = Math.sqrt(bvx * bvx + bvy * bvy);
    if (curSpd > 0) {
      const target = baseSpd * speedMul * 1.2;
      bvx = (bvx / curSpd) * Math.min(curSpd, target);
      bvy = (bvy / curSpd) * Math.min(curSpd, target);
    }

    bvx = clamp(bvx, -0.04, 0.04);
    bvy = clamp(bvy, -0.03, 0.03);

    let scored = false;
    if (bx < -0.02) {
      scored = true;
      for (const p of alivePlayers) {
        if (p.side === 'left') {
          await db.prepare('UPDATE pong_players SET alive = 0 WHERE id = ?').bind(p.id).run();
          p.alive = 0;
        }
      }
      bx = 0.5; by = 0.5;
      bvx = baseSpd * speedMul;
      bvy = (Math.random() - 0.5) * 0.008;
    } else if (bx > 1.02) {
      scored = true;
      for (const p of alivePlayers) {
        if (p.side === 'right') {
          await db.prepare('UPDATE pong_players SET alive = 0 WHERE id = ?').bind(p.id).run();
          p.alive = 0;
        }
      }
      bx = 0.5; by = 0.5;
      bvx = -baseSpd * speedMul;
      bvy = (Math.random() - 0.5) * 0.008;
    }

    await db.prepare(
      'UPDATE pong_ball SET x = ?, y = ?, vx = ?, vy = ? WHERE room_id = ?'
    ).bind(bx, by, bvx, bvy, room.id).run();

    const stillAlive = players.filter(p => p.alive);
    if (stillAlive.length <= 1) {
      const winnerId = stillAlive.length === 1 ? stillAlive[0].user_id : null;
      await db.prepare(
        "UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE id = ?"
      ).bind(winnerId, room.id).run();
      room.status = 'finished';

      await db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id).run();
    }
  }

  const finalPlayers = await db.prepare(
    `SELECT id, username, rating, side, paddle_y, alive, ready, color, user_id
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();

  const finalBall = await db.prepare(
    'SELECT x, y, vx, vy FROM pong_ball WHERE room_id = ?'
  ).bind(room.id).first();

  let winner = null;
  if (room.status === 'finished') {
    const finished = await db.prepare('SELECT winner_id FROM pong_rooms WHERE id = ?').bind(room.id).first();
    winner = finished ? finished.winner_id : null;
  }

  return json({
    room: { id: room.id, code: room.code, mode: room.mode, status: room.status, hostId: room.host_id, maxPlayers: room.max_players, speed: room.speed },
    players: (finalPlayers.results || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      username: p.username,
      rating: p.rating,
      side: p.side,
      paddleY: p.paddle_y,
      alive: !!p.alive,
      ready: !!p.ready,
      color: p.color,
    })),
    ball: finalBall
      ? { x: finalBall.x, y: finalBall.y, vx: finalBall.vx, vy: finalBall.vy }
      : { x: 0.5, y: 0.5, vx: 0, vy: 0 },
    winner,
  });
}
