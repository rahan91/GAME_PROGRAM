import { json, getUserFromRequest } from '../../_lib/auth.js';

const PADDLE_SPEED = 0.045;
const PADDLE_HALF = 0.06;
const BALL_BASE_SPEED = 0.012;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function findNearestPaddle(players, ballCoord, wallSide) {
  const candidates = players.filter(p => p.side === wallSide && p.alive);
  if (!candidates.length) return null;
  return candidates.reduce((best, p) => {
    const dist = Math.abs(p.paddle_y - ballCoord);
    return dist < best.dist ? { paddle: p, dist } : best;
  }, { paddle: candidates[0], dist: Infinity }).paddle;
}

export async function onRequestGet(context) {
  try {
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
  const writes = [];

  if (room.status === 'playing' && ballRow) {
    const alivePlayers = players.filter(p => p.alive);
    const aliveSides = new Set(alivePlayers.map(p => p.side));
    const hasEnoughSides = aliveSides.size >= 2;

    if (hasEnoughSides) {
      const speedMul = room.speed === 'fast' ? 1.5 : room.speed === 'slow' ? 0.7 : 1;

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

      let bx = ballRow.x + ballRow.vx * speedMul;
      let by = ballRow.y + ballRow.vy * speedMul;
      let bvx = ballRow.vx;
      let bvy = ballRow.vy;

      if (!aliveSides.has('top') && by <= 0.02) { by = 0.02; bvy = Math.abs(bvy); }
      if (!aliveSides.has('bottom') && by >= 0.98) { by = 0.98; bvy = -Math.abs(bvy); }
      if (!aliveSides.has('left') && bx <= 0.02) { bx = 0.02; bvx = Math.abs(bvx); }
      if (!aliveSides.has('right') && bx >= 0.98) { bx = 0.98; bvx = -Math.abs(bvx); }

      let hitSides = new Set();
      for (const p of alivePlayers) {
        if (hitSides.has(p.side)) continue;
        if (p.side === 'top') {
          const pL = p.paddle_y - PADDLE_HALF, pR = p.paddle_y + PADDLE_HALF;
          if (bx >= pL && bx <= pR && by <= 0.06 && bvy < 0) { by = 0.06; bvy = Math.abs(bvy) * 1.03; bvx += ((bx - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('top'); }
        } else if (p.side === 'bottom') {
          const pL = p.paddle_y - PADDLE_HALF, pR = p.paddle_y + PADDLE_HALF;
          if (bx >= pL && bx <= pR && by >= 0.94 && bvy > 0) { by = 0.94; bvy = -Math.abs(bvy) * 1.03; bvx += ((bx - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('bottom'); }
        } else if (p.side === 'left') {
          const pT = p.paddle_y - PADDLE_HALF, pB = p.paddle_y + PADDLE_HALF;
          if (by >= pT && by <= pB && bx <= 0.06 && bvx < 0) { bx = 0.06; bvx = Math.abs(bvx) * 1.03; bvy += ((by - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('left'); }
        } else if (p.side === 'right') {
          const pT = p.paddle_y - PADDLE_HALF, pB = p.paddle_y + PADDLE_HALF;
          if (by >= pT && by <= pB && bx >= 0.94 && bvx > 0) { bx = 0.94; bvx = -Math.abs(bvx) * 1.03; bvy += ((by - p.paddle_y) / PADDLE_HALF) * 0.005; hitSides.add('right'); }
        }
      }

      const baseSpd = ballRow.speed || BALL_BASE_SPEED;
      const curSpd = Math.sqrt(bvx * bvx + bvy * bvy);
      if (curSpd > 0) {
        const target = baseSpd * speedMul * 1.15;
        bvx = (bvx / curSpd) * Math.min(curSpd, target);
        bvy = (bvy / curSpd) * Math.min(curSpd, target);
      }
      bvx = clamp(bvx, -0.04, 0.04);
      bvy = clamp(bvy, -0.04, 0.04);

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
        bvx = Math.cos(angle) * baseSpd * speedMul;
        bvy = Math.sin(angle) * baseSpd * speedMul;

        const aliveAfter = players.filter(p => p.alive);
        const aliveSidesAfter = new Set(aliveAfter.map(p => p.side));
        if (aliveSidesAfter.size <= 1) {
          const survivingSide = aliveSidesAfter.size === 1 ? [...aliveSidesAfter][0] : null;
          const winnerUserId = survivingSide ? (aliveAfter.find(p => p.side === survivingSide) || {}).user_id : null;
          writes.push(db.prepare("UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE id = ?").bind(winnerUserId, room.id));
          writes.push(db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id));
          room.status = 'finished';
        }
      }

      if (room.status === 'playing') {
        writes.push(db.prepare('UPDATE pong_ball SET x = ?, y = ?, vx = ?, vy = ? WHERE room_id = ?').bind(bx, by, bvx, bvy, room.id));
      }
    }
  }

  if (writes.length) { try { await db.batch(writes); } catch {} }

  const finalPlayers = await db.prepare(
    `SELECT id, username, rating, side, paddle_y, alive, ready, color, user_id
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(room.id).all();

  const hostPlayer = (finalPlayers.results || []).find(p => String(p.user_id) === String(room.host_id));

  const finalBall = await db.prepare(
    'SELECT x, y, vx, vy FROM pong_ball WHERE room_id = ?'
  ).bind(room.id).first();

  let winner = null, winnerName = null, winnerSide = null;
  if (room.status === 'finished') {
    winner = room.winner_id;
    if (winner) {
      const wp = await db.prepare('SELECT username FROM pong_players WHERE room_id = ? AND user_id = ?').bind(room.id, winner).first();
      winnerName = wp ? wp.username : null;
    }
  }

  const me = await getUserFromRequest(context.env, context.request);
  const myUserId = me ? String(me.id) : null;
  const isHost = myUserId ? await db.prepare('SELECT 1 FROM pong_rooms WHERE id = ? AND host_id = ?').bind(room.id, me.id).first() : false;
  const myIdx = myUserId ? (finalPlayers.results || []).findIndex(p => String(Number(p.user_id)) === myUserId || String(p.user_id) === myUserId) : -1;

  let points = null;
  if (room.status === 'finished' && me) {
    const isWinner = winner && String(winner) === myUserId;
    points = isWinner ? 50 : 10;
  }

  return json({
    room: { id: room.id, code: room.code, mode: room.mode, status: room.status, hostId: room.host_id, hostUsername: hostPlayer ? hostPlayer.username : null, maxPlayers: room.max_players, speed: room.speed, isHost: !!isHost },
    myIndex: myIdx,
    players: (finalPlayers.results || []).map((p) => ({
      id: p.id, userId: p.user_id, username: p.username, rating: p.rating,
      side: p.side, paddleY: p.paddle_y, alive: !!p.alive, ready: !!p.ready, color: p.color,
    })),
    ball: finalBall ? { x: finalBall.x, y: finalBall.y, vx: finalBall.vx, vy: finalBall.vy } : { x: 0.5, y: 0.5, vx: 0, vy: 0 },
    winner, winnerName, points,
  });
  } catch (e) {
    return json({ error: 'State error: ' + (e.message || e) }, 500);
  }
}
