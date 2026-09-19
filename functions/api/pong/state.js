import { json, getUserFromRequest } from '../../_lib/auth.js';

const PADDLE_HALF = 0.12;
const BALL_SPEED = 0.018;
const PADDLE_SPEED = 0.035;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function findNearestPaddle(players, coord, wallSide) {
  const candidates = players.filter(p => p.side === wallSide && p.alive);
  if (!candidates.length) return null;
  return candidates.reduce((best, p) => {
    const dist = Math.abs(p.paddle_y - coord);
    return dist < best.dist ? { paddle: p, dist } : best;
  }, { paddle: candidates[0], dist: Infinity }).paddle;
}

export async function handleState(context, code, user) {
  const db = context.env.DATABASE;

  let room;
  try {
    room = await db.prepare(
      'SELECT id, code, mode, status, host_id, max_players, speed, winner_id, rounds_target, round_num, score_top, score_bottom, score_left, score_right FROM pong_rooms WHERE code = ?'
    ).bind(code.toUpperCase()).first();
  } catch {
    room = await db.prepare(
      'SELECT id, code, mode, status, host_id, max_players, speed, winner_id FROM pong_rooms WHERE code = ?'
    ).bind(code.toUpperCase()).first();
    if (room) { room.rounds_target = 3; room.round_num = 0; room.score_top = 0; room.score_bottom = 0; room.score_left = 0; room.score_right = 0; }
  }
  if (!room) return json({ error: 'Room not found' }, 404);

  const playerRows = await db.prepare(
    `SELECT id, username, rating, side, paddle_y, alive, ready, color, user_id, dir
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();
  const players = playerRows.results || [];

  let ballData = null;

  if (room.status === 'playing') {
    const now = Date.now();
    const lastTick = Number(room.last_tick_at) || 0;
    const elapsed = now - lastTick;
    const TICK_MS = 40;

    const ballRow = await db.prepare(
      'SELECT x, y, vx, vy, speed FROM pong_ball WHERE room_id = ?'
    ).bind(room.id).first();

    const writes = [];

    // Always update paddle positions on every poll
    for (const p of players) {
      if (!p.alive) continue;
      const d = p.dir || 0;
      let newY = p.paddle_y + d * PADDLE_SPEED;
      newY = clamp(newY, PADDLE_HALF, 1 - PADDLE_HALF);
      if (newY !== p.paddle_y) {
        writes.push(db.prepare('UPDATE pong_players SET paddle_y = ? WHERE id = ?').bind(newY, p.id));
        p.paddle_y = newY;
      }
    }

    // Ball physics — multiple sub-steps if enough time elapsed
    if (ballRow) {
      const alivePlayers = players.filter(p => p.alive);
      const aliveSides = new Set(alivePlayers.map(p => p.side));

      if (aliveSides.size >= 2) {
        const speedMul = room.speed === 'fast' ? 1.5 : room.speed === 'slow' ? 0.7 : 1;
        const subSteps = Math.min(Math.ceil(elapsed / TICK_MS), 4);

        let bx = Number(ballRow.x);
        let by = Number(ballRow.y);
        let bvx = Number(ballRow.vx);
        let bvy = Number(ballRow.vy);
        const baseSpd = Math.sqrt(bvx * bvx + bvy * bvy);
        const stepVx = bvx * speedMul;
        const stepVy = bvy * speedMul;

        for (let step = 0; step < subSteps; step++) {
          bx += stepVx;
          by += stepVy;

          // Bounce off walls with no alive players
          if (!aliveSides.has('top') && by < PADDLE_HALF * 0.3) { by = PADDLE_HALF * 0.3; bvy = Math.abs(bvy); }
          if (!aliveSides.has('bottom') && by > 1 - PADDLE_HALF * 0.3) { by = 1 - PADDLE_HALF * 0.3; bvy = -Math.abs(bvy); }
          if (!aliveSides.has('left') && bx < PADDLE_HALF * 0.3) { bx = PADDLE_HALF * 0.3; bvx = Math.abs(bvx); }
          if (!aliveSides.has('right') && bx > 1 - PADDLE_HALF * 0.3) { bx = 1 - PADDLE_HALF * 0.3; bvx = -Math.abs(bvx); }

          // Paddle collisions
          const hitSides = new Set();
          for (const p of alivePlayers) {
            if (hitSides.has(p.side)) continue;
            const half = PADDLE_HALF;

            if (p.side === 'top') {
              const pL = p.paddle_y - half, pR = p.paddle_y + half;
              if (bx >= pL && bx <= pR && by <= 0.06 && stepVy < 0) {
                by = 0.06;
                bvy = Math.abs(bvy) * 1.02;
                bvx += ((bx - p.paddle_y) / half) * 0.004;
                hitSides.add('top');
              }
            } else if (p.side === 'bottom') {
              const pL = p.paddle_y - half, pR = p.paddle_y + half;
              if (bx >= pL && bx <= pR && by >= 0.94 && stepVy > 0) {
                by = 0.94;
                bvy = -Math.abs(bvy) * 1.02;
                bvx += ((bx - p.paddle_y) / half) * 0.004;
                hitSides.add('bottom');
              }
            } else if (p.side === 'left') {
              const pT = p.paddle_y - half, pB = p.paddle_y + half;
              if (by >= pT && by <= pB && bx <= 0.06 && stepVx < 0) {
                bx = 0.06;
                bvx = Math.abs(bvx) * 1.02;
                bvy += ((by - p.paddle_y) / half) * 0.004;
                hitSides.add('left');
              }
            } else if (p.side === 'right') {
              const pT = p.paddle_y - half, pB = p.paddle_y + half;
              if (by >= pT && by <= pB && bx >= 0.94 && stepVx > 0) {
                bx = 0.94;
                bvx = -Math.abs(bvx) * 1.02;
                bvy += ((by - p.paddle_y) / half) * 0.004;
                hitSides.add('right');
              }
            }
          }
        }

        // Speed normalization
        const curSpd = Math.sqrt(bvx * bvx + bvy * bvy);
        if (curSpd > 0 && baseSpd > 0) {
          bvx = (bvx / curSpd) * baseSpd;
          bvy = (bvy / curSpd) * baseSpd;
        }

        // Check scoring
        let scoredSide = null;
        if (by < -0.02) scoredSide = 'top';
        else if (by > 1.02) scoredSide = 'bottom';
        else if (bx < -0.02) scoredSide = 'left';
        else if (bx > 1.02) scoredSide = 'right';

        if (scoredSide) {
          const victim = findNearestPaddle(alivePlayers, scoredSide === 'left' || scoredSide === 'right' ? by : bx, scoredSide);
          if (victim) {
            writes.push(db.prepare('UPDATE pong_players SET alive = 0 WHERE id = ?').bind(victim.id));
            victim.alive = 0;
          }

          bx = 0.5; by = 0.5;
          const angle = Math.random() * Math.PI * 2;
          bvx = Math.cos(angle) * baseSpd;
          bvy = Math.sin(angle) * baseSpd;

          const sides = ['top', 'bottom', 'left', 'right'];
          for (const s of sides) {
            if (s === scoredSide) continue;
            const col = 'score_' + s;
            room[col] = (room[col] || 0) + 1;
            writes.push(db.prepare('UPDATE pong_rooms SET ' + col + ' = ? WHERE id = ?').bind(room[col], room.id));
          }

          const target = room.rounds_target || 3;
          const scores = { top: room.score_top || 0, bottom: room.score_bottom || 0, left: room.score_left || 0, right: room.score_right || 0 };
          const maxScore = Math.max(...Object.values(scores));
          const sidesAtMax = sides.filter(s => scores[s] === maxScore);

          if (maxScore >= target) {
            if (sidesAtMax.length === 1) {
              const winSide = sidesAtMax[0];
              const wp = players.find(p => p.side === winSide);
              const winnerUserId = wp ? wp.user_id : null;
              writes.push(db.prepare("UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE id = ?").bind(winnerUserId, room.id));
              writes.push(db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id));
              room.status = 'finished';
              room.winner_id = winnerUserId;
            }
          }

          if (room.status === 'playing') {
            for (const p of players) {
              writes.push(db.prepare('UPDATE pong_players SET paddle_y = 0.5, alive = 1, dir = 0 WHERE id = ?').bind(p.id));
              p.alive = 1;
              p.paddle_y = 0.5;
              p.dir = 0;
            }
          }
        }

        if (room.status === 'playing') {
          writes.push(db.prepare('UPDATE pong_ball SET x = ?, y = ?, vx = ?, vy = ? WHERE room_id = ?').bind(bx, by, bvx, bvy, room.id));
        }

        ballData = { x: bx, y: by, vx: bvx, vy: bvy };
      } else {
        ballData = { x: Number(ballRow.x), y: Number(ballRow.y), vx: Number(ballRow.vx), vy: Number(ballRow.vy) };
      }

      writes.push(db.prepare('UPDATE pong_rooms SET last_tick_at = ? WHERE id = ?').bind(now, room.id));
    }

    if (writes.length) { try { await db.batch(writes); } catch {} }
  }

  if (!ballData) {
    const ballRow = await db.prepare('SELECT x, y, vx, vy FROM pong_ball WHERE room_id = ?').bind(room.id).first();
    ballData = ballRow ? { x: ballRow.x, y: ballRow.y, vx: ballRow.vx, vy: ballRow.vy } : { x: 0.5, y: 0.5, vx: 0, vy: 0 };
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
      side: p.side, paddleY: p.paddle_y, alive: !!p.alive, ready: !!p.ready, color: p.color,
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

    if (body.dir !== undefined) {
      const dir = Number(body.dir);
      if (Number.isInteger(dir) && dir >= -1 && dir <= 1) {
        const db = context.env.DATABASE;
        await db.prepare(
          "UPDATE pong_players SET dir = ? WHERE room_id = (SELECT id FROM pong_rooms WHERE code = ?) AND user_id = ?"
        ).bind(dir, code, user.id).run();
      }
    }

    return await handleState(context, code, user);
  } catch (e) {
    return json({ error: 'State error: ' + (e.message || e) }, 500);
  }
}
