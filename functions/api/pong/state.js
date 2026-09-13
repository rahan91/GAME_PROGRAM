import { json } from '../../_lib/auth.js';

const PADDLE_SPEED = 0.045;
const PADDLE_HALF = 0.06;
const BALL_BASE_SPEED = 0.012;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function findNearestPaddle(players, ballCoord, wallSide) {
  const candidates = players.filter(p => p.side === wallSide && p.alive);
  if (!candidates.length) return null;

  if (wallSide === 'top' || wallSide === 'bottom') {
    return candidates.reduce((best, p) => {
      const dist = Math.abs(p.paddle_y - ballCoord);
      return dist < best.dist ? { paddle: p, dist } : best;
    }, { paddle: candidates[0], dist: Infinity }).paddle;
  } else {
    return candidates.reduce((best, p) => {
      const dist = Math.abs(p.paddle_y - ballCoord);
      return dist < best.dist ? { paddle: p, dist } : best;
    }, { paddle: candidates[0], dist: Infinity }).paddle;
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('room');
  if (!code) return json({ error: 'Missing room parameter' }, 400);

  const db = context.env.DATABASE;

  let room;
  try {
    room = await db.prepare(
      'SELECT id, code, mode, status, host_id, max_players, speed, rounds_target, round_num FROM pong_rooms WHERE code = ?'
    ).bind(code.toUpperCase()).first();
  } catch (e) {
    room = await db.prepare(
      'SELECT id, code, mode, status, host_id, max_players, speed FROM pong_rooms WHERE code = ?'
    ).bind(code.toUpperCase()).first();
    if (room) { room.rounds_target = 3; room.round_num = 0; }
  }
  if (!room) return json({ error: 'Room not found' }, 404);

  const playerRows = await db.prepare(
    `SELECT id, username, rating, side, paddle_y, alive, ready, color, user_id, dir
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();
  const players = playerRows.results || [];

  const ballRow = await db.prepare(
    'SELECT x, y, vx, vy, speed FROM pong_ball WHERE room_id = ?'
  ).bind(room.id).first();

  const isQuads = room.mode === 'quads';

  if (room.status === 'playing' && ballRow) {
    const alivePlayers = players.filter(p => p.alive);
    const aliveSides = new Set(alivePlayers.map(p => p.side));
    const minSides = isQuads ? 4 : 2;
    const hasEnoughSides = aliveSides.size >= 2;

    if (hasEnoughSides) {
      const speedMul = room.speed === 'fast' ? 1.5 : room.speed === 'slow' ? 0.7 : 1;

      // Move paddles
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

      // Move ball
      let bx = ballRow.x + ballRow.vx * speedMul;
      let by = ballRow.y + ballRow.vy * speedMul;
      let bvx = ballRow.vx;
      let bvy = ballRow.vy;

      // Wall bounce (all 4 walls)
      if (by <= 0.02) { by = 0.02; bvy = Math.abs(bvy); }
      if (by >= 0.98) { by = 0.98; bvy = -Math.abs(bvy); }
      if (bx <= 0.02) { bx = 0.02; bvx = Math.abs(bvx); }
      if (bx >= 0.98) { bx = 0.98; bvx = -Math.abs(bvx); }

      // Paddle collision (4 sides)
      let hitSides = new Set();
      for (const p of alivePlayers) {
        if (hitSides.has(p.side)) continue;

        if (p.side === 'top') {
          const paddleLeft = p.paddle_y - PADDLE_HALF;
          const paddleRight = p.paddle_y + PADDLE_HALF;
          if (bx >= paddleLeft && bx <= paddleRight && by <= 0.06 && bvy < 0) {
            by = 0.06;
            bvy = Math.abs(bvy) * 1.03;
            const hitPos = (bx - p.paddle_y) / PADDLE_HALF;
            bvx += hitPos * 0.005;
            hitSides.add('top');
          }
        } else if (p.side === 'bottom') {
          const paddleLeft = p.paddle_y - PADDLE_HALF;
          const paddleRight = p.paddle_y + PADDLE_HALF;
          if (bx >= paddleLeft && bx <= paddleRight && by >= 0.94 && bvy > 0) {
            by = 0.94;
            bvy = -Math.abs(bvy) * 1.03;
            const hitPos = (bx - p.paddle_y) / PADDLE_HALF;
            bvx += hitPos * 0.005;
            hitSides.add('bottom');
          }
        } else if (p.side === 'left') {
          const paddleTop = p.paddle_y - PADDLE_HALF;
          const paddleBot = p.paddle_y + PADDLE_HALF;
          if (by >= paddleTop && by <= paddleBot && bx <= 0.06 && bvx < 0) {
            bx = 0.06;
            bvx = Math.abs(bvx) * 1.03;
            const hitPos = (by - p.paddle_y) / PADDLE_HALF;
            bvy += hitPos * 0.005;
            hitSides.add('left');
          }
        } else if (p.side === 'right') {
          const paddleTop = p.paddle_y - PADDLE_HALF;
          const paddleBot = p.paddle_y + PADDLE_HALF;
          if (by >= paddleTop && by <= paddleBot && bx >= 0.94 && bvx > 0) {
            bx = 0.94;
            bvx = -Math.abs(bvx) * 1.03;
            const hitPos = (by - p.paddle_y) / PADDLE_HALF;
            bvy += hitPos * 0.005;
            hitSides.add('right');
          }
        }
      }

      // Clamp speed
      const baseSpd = ballRow.speed || BALL_BASE_SPEED;
      const curSpd = Math.sqrt(bvx * bvx + bvy * bvy);
      if (curSpd > 0) {
        const target = baseSpd * speedMul * 1.15;
        bvx = (bvx / curSpd) * Math.min(curSpd, target);
        bvy = (bvy / curSpd) * Math.min(curSpd, target);
      }
      bvx = clamp(bvx, -0.04, 0.04);
      bvy = clamp(bvy, -0.04, 0.04);

      // Scoring — ball past wall
      let scoredSide = null;
      if (by < -0.02) scoredSide = 'top';
      else if (by > 1.02) scoredSide = 'bottom';
      else if (bx < -0.02) scoredSide = 'left';
      else if (bx > 1.02) scoredSide = 'right';

      if (scoredSide) {
        // Kill nearest paddle on scored-against side
        const victim = findNearestPaddle(alivePlayers, scoredSide === 'left' || scoredSide === 'right' ? by : bx, scoredSide);
        if (victim) {
          await db.prepare('UPDATE pong_players SET alive = 0 WHERE id = ?').bind(victim.id).run();
          victim.alive = 0;
        }

        // Reset ball to center with random direction
        bx = 0.5; by = 0.5;
        const angle = Math.random() * Math.PI * 2;
        bvx = Math.cos(angle) * baseSpd * speedMul;
        bvy = Math.sin(angle) * baseSpd * speedMul;

        // Check if round is over (only one side left alive)
        const aliveAfter = players.filter(p => p.alive);
        const aliveSidesAfter = new Set(aliveAfter.map(p => p.side));
        if (aliveSidesAfter.size <= 1) {
          // Round over — surviving side gets a point
          const survivingSide = aliveSidesAfter.size === 1 ? [...aliveSidesAfter][0] : null;

          if (survivingSide === 'left' || survivingSide === 'top') {
            try { await db.prepare('UPDATE pong_rooms SET round_num = round_num + 1 WHERE id = ?').bind(room.id).run(); } catch {}
          } else if (survivingSide === 'right' || survivingSide === 'bottom') {
            try { await db.prepare('UPDATE pong_rooms SET round_num = round_num - 1 WHERE id = ?').bind(room.id).run(); } catch {}
          }

          let updatedRoom = { round_num: 0, rounds_target: 3 };
          try { updatedRoom = await db.prepare('SELECT round_num, rounds_target FROM pong_rooms WHERE id = ?').bind(room.id).first() || updatedRoom; } catch {}
          const absScore = Math.abs(updatedRoom.round_num || 0);

          if (absScore >= (updatedRoom.rounds_target || 3)) {
            // Game over
            await db.prepare("UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE id = ?").bind(survivingSide, room.id).run();
            room.status = 'finished';
            await db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id).run();
          } else {
            // New round — respawn all
            for (const p of players) {
              await db.prepare('UPDATE pong_players SET paddle_y = 0.5, alive = 1 WHERE id = ?').bind(p.id).run();
              p.alive = 1;
              p.paddle_y = 0.5;
            }
          }
        }
      }

      if (room.status === 'playing') {
        await db.prepare(
          'UPDATE pong_ball SET x = ?, y = ?, vx = ?, vy = ? WHERE room_id = ?'
        ).bind(bx, by, bvx, bvy, room.id).run();
      }
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
  let winnerName = null;
  let winnerSide = null;
  if (room.status === 'finished') {
    winnerSide = room.winner_id;
    if (winnerSide) {
      const wp = await db.prepare('SELECT username FROM pong_players WHERE room_id = ? AND side = ? AND alive = 1 LIMIT 1').bind(room.id, winnerSide).first();
      winnerName = wp ? wp.username : null;
      winner = wp ? wp.user_id : null;
    }
  }

  const leftScore = (room.round_num || 0) > 0 ? room.round_num : 0;
  const rightScore = (room.round_num || 0) < 0 ? Math.abs(room.round_num) : 0;

  return json({
    room: { id: room.id, code: room.code, mode: room.mode, status: room.status, hostId: room.host_id, maxPlayers: room.max_players, speed: room.speed, roundsTarget: room.rounds_target || 3, roundNum: room.round_num || 0, leftScore, rightScore },
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
    winnerName,
    winnerSide,
  });
}
