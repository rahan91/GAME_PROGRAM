import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function handleState(context, code, user) {
  const db = context.env.DATABASE;

  let room;
  try {
    room = await db.prepare(
      'SELECT id, code, mode, status, host_id, max_players, speed, winner_id, rounds_target, score_top, score_bottom, score_left, score_right FROM pong_rooms WHERE code = ?'
    ).bind(code.toUpperCase()).first();
  } catch {
    room = await db.prepare(
      'SELECT id, code, mode, status, host_id, max_players, speed, winner_id FROM pong_rooms WHERE code = ?'
    ).bind(code.toUpperCase()).first();
    if (room) { room.rounds_target = 3; room.score_top = 0; room.score_bottom = 0; room.score_left = 0; room.score_right = 0; }
  }
  if (!room) return json({ error: 'Room not found' }, 404);

  const playerRows = await db.prepare(
    `SELECT id, username, rating, side, alive, ready, color, user_id, dir
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();
  const players = playerRows.results || [];

  let ballData = null;
  try {
    const ballRow = await db.prepare('SELECT x, y, vx, vy FROM pong_ball WHERE room_id = ?').bind(room.id).first();
    ballData = ballRow ? { x: ballRow.x, y: ballRow.y, vx: ballRow.vx, vy: ballRow.vy } : { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  } catch {
    ballData = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  }

  const hostPlayer = players.find(p => String(p.user_id) === String(room.host_id));

  let winner = null, winnerName = null;
  if (room.status === 'finished' && room.winner_id) {
    winner = room.winner_id;
    const wp = players.find(p => String(Number(p.user_id)) === String(Number(winner)) || String(p.user_id) === String(winner));
    winnerName = wp ? wp.username : null;
  }

  const myUserId = user ? String(user.id) : null;
  const isHost = myUserId ? await db.prepare('SELECT 1 FROM pong_rooms WHERE id = ? AND host_id = ?').bind(room.id, user.id).first() : false;
  const myIdx = myUserId ? players.findIndex(p => String(Number(p.user_id)) === myUserId || String(p.user_id) === myUserId) : -1;

  let points = null;
  if (room.status === 'finished' && user) {
    const isWinner = winner && (String(Number(winner)) === myUserId || String(winner) === myUserId);
    points = isWinner ? 50 : 10;
  }

  return json({
    room: { id: room.id, code: room.code, mode: room.mode, status: room.status, hostId: room.host_id, hostUsername: hostPlayer ? hostPlayer.username : null, maxPlayers: room.max_players, speed: room.speed, isHost: !!isHost, roundsTarget: room.rounds_target || 3, leftScore: room.score_left || 0, rightScore: room.score_right || 0, topScore: room.score_top || 0, bottomScore: room.score_bottom || 0 },
    myIndex: myIdx,
    players: players.map((p) => ({
      id: p.id, userId: p.user_id, username: p.username, rating: p.rating,
      side: p.side, dir: p.dir || 0, alive: !!p.alive, ready: !!p.ready, color: p.color,
    })),
    ball: ballData,
    winner, winnerName, points,
  });
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const code = url.searchParams.get('room');
    if (!code) return json({ error: 'Missing room parameter' }, 400);
    const user = await getUserFromRequest(context.env, context.request);
    return await handleState(context, code, user);
  } catch (e) {
    return json({ error: 'State error: ' + (e.message || e) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const user = await getUserFromRequest(context.env, context.request);
    if (!user) return json({ error: 'Not logged in' }, 401);

    let body;
    try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

    const code = body && body.room ? String(body.room).toUpperCase() : null;
    if (!code) return json({ error: 'Missing room' }, 400);

    const db = context.env.DATABASE;

    if (body.dir !== undefined) {
      const dir = Number(body.dir);
      if (Number.isInteger(dir) && dir >= -1 && dir <= 1) {
        await db.prepare(
          "UPDATE pong_players SET dir = ? WHERE room_id = (SELECT id FROM pong_rooms WHERE code = ?) AND user_id = ?"
        ).bind(dir, code, user.id).run();
      }
    }

    if (body.scoredSide) {
      const scoredSide = String(body.scoredSide);
      const VALID = new Set(['top', 'bottom', 'left', 'right']);
      if (VALID.has(scoredSide)) {
        const room = await db.prepare(
          'SELECT id, status, rounds_target, score_top, score_bottom, score_left, score_right FROM pong_rooms WHERE code = ?'
        ).bind(code).first();
        if (room && room.status === 'playing') {
          const victim = await db.prepare(
            'SELECT id FROM pong_players WHERE room_id = ? AND side = ? AND alive = 1 LIMIT 1'
          ).bind(room.id, scoredSide).first();
          if (victim) {
            await db.prepare('UPDATE pong_players SET alive = 0 WHERE id = ?').bind(victim.id).run();
          }

          const scores = {
            top: Number(room.score_top) || 0,
            bottom: Number(room.score_bottom) || 0,
            left: Number(room.score_left) || 0,
            right: Number(room.score_right) || 0,
          };
          const sides = ['top', 'bottom', 'left', 'right'];
          const writes = [];
          for (const s of sides) {
            if (s === scoredSide) continue;
            scores[s]++;
            writes.push(db.prepare('UPDATE pong_rooms SET score_' + s + ' = ? WHERE id = ?').bind(scores[s], room.id));
          }

          const target = Number(room.rounds_target) || 3;
          const maxScore = Math.max(...Object.values(scores));
          const sidesAtMax = sides.filter(s => scores[s] === maxScore);
          let gameOver = false;

          if (maxScore >= target && sidesAtMax.length === 1) {
            const winSide = sidesAtMax[0];
            const wp = await db.prepare('SELECT user_id FROM pong_players WHERE room_id = ? AND side = ?').bind(room.id, winSide).first();
            const winnerUserId = wp ? wp.user_id : null;
            writes.push(db.prepare("UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE id = ?").bind(winnerUserId, room.id));
            gameOver = true;
            writes.push(db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id));
          }

          if (!gameOver) {
            const speed = await db.prepare('SELECT speed FROM pong_rooms WHERE id = ?').bind(room.id).first();
            const spd = speed && speed.speed === 'fast' ? 0.045 : speed && speed.speed === 'slow' ? 0.02 : 0.03;
            const angle = Math.random() * Math.PI * 2;
            writes.push(db.prepare('UPDATE pong_ball SET x = 0.5, y = 0.5, vx = ?, vy = ? WHERE room_id = ?')
              .bind(Math.cos(angle) * spd, Math.sin(angle) * spd, room.id));
            for (const p of (await db.prepare('SELECT id FROM pong_players WHERE room_id = ?').bind(room.id).all()).results || []) {
              writes.push(db.prepare('UPDATE pong_players SET alive = 1 WHERE id = ?').bind(p.id));
            }
          }

          if (writes.length) await db.batch(writes);
        }
      }
    }

    return await handleState(context, code, user);
  } catch (e) {
    return json({ error: 'State error: ' + (e.message || e) }, 500);
  }
}
