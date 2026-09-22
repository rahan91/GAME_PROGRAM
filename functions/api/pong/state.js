import { json, getUserFromRequest } from '../../_lib/auth.js';

const PADDLE_HALF = 0.12;
const PADDLE_SPEED = 0.045;
const BALL_SPEEDS = { fast: 0.045, slow: 0.02, medium: 0.03 };
const SPEED_MUL = { fast: 1.5, slow: 0.7, medium: 1 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

async function loadRoom(db, code) {
  try {
    return await db.prepare(
      `SELECT id, code, mode, status, host_id, max_players, speed, winner_id,
              rounds_target, score_top, score_bottom, score_left, score_right,
              last_tick_at
       FROM pong_rooms WHERE code = ?`
    ).bind(code).first();
  } catch {
    return await db.prepare(
      'SELECT id, code, mode, status, host_id, max_players, speed, winner_id FROM pong_rooms WHERE code = ?'
    ).bind(code).first();
  }
}

async function loadPlayers(db, roomId) {
  const rows = await db.prepare(
    `SELECT id, username, rating, side, alive, ready, color, user_id, dir, paddle_y
     FROM pong_players WHERE room_id = ? ORDER BY joined_at ASC`
  ).bind(roomId).all();
  return rows.rows || rows.results || [];
}

async function loadBall(db, roomId) {
  try {
    const row = await db.prepare('SELECT x, y, vx, vy FROM pong_ball WHERE room_id = ?').bind(roomId).first();
    return row ? { x: row.x, y: row.y, vx: row.vx, vy: row.vy } : { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  } catch {
    return { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  }
}

function tickBall(ball, players, speed, elapsed) {
  const sm = SPEED_MUL[speed] || 1;
  const base = BALL_SPEEDS[speed] || 0.03;
  const dt = (elapsed || 33) / 16.67;
  let { x: bx, y: by, vx: bvx, vy: bvy } = ball;

  bx += bvx * sm * dt;
  by += bvy * sm * dt;

  const aliveSides = new Set(players.filter(p => p.alive).map(p => p.side));
  if (!aliveSides.has('top') && by < PADDLE_HALF * 0.5) { by = PADDLE_HALF * 0.5; bvy = Math.abs(bvy); }
  if (!aliveSides.has('bottom') && by > 1 - PADDLE_HALF * 0.5) { by = 1 - PADDLE_HALF * 0.5; bvy = -Math.abs(bvy); }
  if (!aliveSides.has('left') && bx < PADDLE_HALF * 0.5) { bx = PADDLE_HALF * 0.5; bvx = Math.abs(bvx); }
  if (!aliveSides.has('right') && bx > 1 - PADDLE_HALF * 0.5) { bx = 1 - PADDLE_HALF * 0.5; bvx = -Math.abs(bvx); }

  for (const p of players) {
    if (!p.alive) continue;
    const py = Number(p.paddle_y) || 0.5;
    if (p.side === 'top') {
      const pL = py - PADDLE_HALF, pR = py + PADDLE_HALF;
      if (bx >= pL && bx <= pR && by <= 0.06 && bvy < 0) {
        by = 0.06; bvy = Math.abs(bvy) * 1.02;
        bvx += ((bx - py) / PADDLE_HALF) * 0.004;
      }
    } else if (p.side === 'bottom') {
      const pL = py - PADDLE_HALF, pR = py + PADDLE_HALF;
      if (bx >= pL && bx <= pR && by >= 0.94 && bvy > 0) {
        by = 0.94; bvy = -Math.abs(bvy) * 1.02;
        bvx += ((bx - py) / PADDLE_HALF) * 0.004;
      }
    } else if (p.side === 'left') {
      const pT = py - PADDLE_HALF, pB = py + PADDLE_HALF;
      if (by >= pT && by <= pB && bx <= 0.06 && bvx < 0) {
        bx = 0.06; bvx = Math.abs(bvx) * 1.02;
        bvy += ((by - py) / PADDLE_HALF) * 0.004;
      }
    } else if (p.side === 'right') {
      const pT = py - PADDLE_HALF, pB = py + PADDLE_HALF;
      if (by >= pT && by <= pB && bx >= 0.94 && bvx > 0) {
        bx = 0.94; bvx = -Math.abs(bvx) * 1.02;
        bvy += ((by - py) / PADDLE_HALF) * 0.004;
      }
    }
  }

  const spd = Math.sqrt(bvx * bvx + bvy * bvy);
  if (spd > base * 2) { bvx = (bvx / spd) * base * 2; bvy = (bvy / spd) * base * 2; }
  if (spd < base * 0.5 && spd > 0) { bvx = (bvx / spd) * base * 0.5; bvy = (bvy / spd) * base * 0.5; }

  let scoredSide = null;
  if (by < -0.02) scoredSide = 'top';
  else if (by > 1.02) scoredSide = 'bottom';
  else if (bx < -0.02) scoredSide = 'left';
  else if (bx > 1.02) scoredSide = 'right';

  return { x: bx, y: by, vx: bvx, vy: bvy, scoredSide };
}

async function tickAndUpdate(db, room, players) {
  const now = Date.now();
  const lastTick = Number(room.last_tick_at);
  const realElapsed = lastTick > 0 ? (now - lastTick) : 100;
  if (realElapsed < 25) return;

  // Cap catch-up physics so throttled/backgrounded tabs can't tunnel the ball
  // through paddles or walls; the remainder is discarded, not fast-forwarded.
  const elapsed = Math.min(realElapsed, 400);

  const paddleWrites = [];
  const updatedPlayers = players.map(p => {
    if (!p.alive || !p.dir) return p;
    const dt = Math.min(elapsed, 50) / 16.67;
    const newY = clamp((Number(p.paddle_y) || 0.5) + p.dir * PADDLE_SPEED * dt, PADDLE_HALF, 1 - PADDLE_HALF);
    paddleWrites.push(db.prepare('UPDATE pong_players SET paddle_y = ? WHERE id = ?').bind(newY, p.id));
    return { ...p, paddle_y: newY };
  });

  const ball = await loadBall(db, room.id);
  const maxStep = 16.67;
  const steps = Math.max(1, Math.min(8, Math.ceil(elapsed / maxStep)));
  const stepMs = elapsed / steps;
  let currentBall = ball;
  let result;
  for (let i = 0; i < steps; i++) {
    result = tickBall(currentBall, updatedPlayers, room.speed, stepMs);
    if (result.scoredSide) break;
    currentBall = { x: result.x, y: result.y, vx: result.vx, vy: result.vy };
  }

  const writes = [...paddleWrites];

  if (result.scoredSide) {
    const victim = await db.prepare(
      'SELECT id FROM pong_players WHERE room_id = ? AND side = ? AND alive = 1 LIMIT 1'
    ).bind(room.id, result.scoredSide).first();
    if (victim) writes.push(db.prepare('UPDATE pong_players SET alive = 0 WHERE id = ?').bind(victim.id));

    const scores = {
      top: Number(room.score_top) || 0,
      bottom: Number(room.score_bottom) || 0,
      left: Number(room.score_left) || 0,
      right: Number(room.score_right) || 0,
    };
    const activeSides = new Set(players.map(p => p.side));
    const scoringSides = ['top', 'bottom', 'left', 'right'].filter(s => s !== result.scoredSide && activeSides.has(s));
    for (const s of scoringSides) {
      scores[s]++;
      writes.push(db.prepare('UPDATE pong_rooms SET score_' + s + ' = ? WHERE id = ?').bind(scores[s], room.id));
    }

    const target = Number(room.rounds_target) || 3;
    const activeScoreArr = ['top', 'bottom', 'left', 'right'].filter(s => activeSides.has(s));
    const maxScore = Math.max(...activeScoreArr.map(s => scores[s]));
    const sidesAtMax = activeScoreArr.filter(s => scores[s] === maxScore);
    let gameOver = false;

    if (maxScore >= target && sidesAtMax.length === 1) {
      const winSide = sidesAtMax[0];
      const wp = await db.prepare('SELECT user_id FROM pong_players WHERE room_id = ? AND side = ?').bind(room.id, winSide).first();
      writes.push(db.prepare("UPDATE pong_rooms SET status = 'finished', winner_id = ? WHERE id = ?").bind(wp ? wp.user_id : null, room.id));
      gameOver = true;
      writes.push(db.prepare('DELETE FROM pong_ball WHERE room_id = ?').bind(room.id));
    }

    if (!gameOver) {
      const spd = BALL_SPEEDS[room.speed] || 0.03;
      const angle = Math.random() * Math.PI * 2;
      writes.push(db.prepare('UPDATE pong_ball SET x = 0.5, y = 0.5, vx = ?, vy = ? WHERE room_id = ?')
        .bind(Math.cos(angle) * spd, Math.sin(angle) * spd, room.id));
      const allP = await db.prepare('SELECT id FROM pong_players WHERE room_id = ?').bind(room.id).all();
      for (const p of (allP.results || [])) {
        writes.push(db.prepare('UPDATE pong_players SET alive = 1, paddle_y = 0.5 WHERE id = ?').bind(p.id));
      }
    }
  } else {
    writes.push(db.prepare('UPDATE pong_ball SET x = ?, y = ?, vx = ?, vy = ? WHERE room_id = ?')
      .bind(result.x, result.y, result.vx, result.vy, room.id));
  }

  writes.push(db.prepare('UPDATE pong_rooms SET last_tick_at = ? WHERE id = ?').bind(now, room.id));

  if (writes.length) {
    try { await db.batch(writes); } catch (e) { console.error('pong state batch error:', e); }
  }
}

export async function handleState(context, code, user) {
  const db = context.env.DATABASE;
  const room = await loadRoom(db, code.toUpperCase());
  if (!room) return json({ error: 'Room not found' }, 404);

  const players = await loadPlayers(db, room.id);

  if (room.status === 'playing') {
    await tickAndUpdate(db, room, players);
  }

  const freshRoom = room.status === 'playing' ? await loadRoom(db, code.toUpperCase()) || room : room;
  const freshPlayers = freshRoom !== room ? await loadPlayers(db, freshRoom.id) : players;
  const ballData = await loadBall(db, freshRoom.id);

  const hostPlayer = freshPlayers.find(p => String(p.user_id) === String(freshRoom.host_id));

  let winner = null, winnerName = null;
  if (freshRoom.status === 'finished' && freshRoom.winner_id) {
    winner = freshRoom.winner_id;
    const wp = freshPlayers.find(p => String(Number(p.user_id)) === String(Number(winner)) || String(p.user_id) === String(winner));
    winnerName = wp ? wp.username : null;
  }

  const myUserId = user ? String(user.id) : null;
  const isHost = myUserId ? await db.prepare('SELECT 1 FROM pong_rooms WHERE id = ? AND host_id = ?').bind(freshRoom.id, user.id).first() : false;
  const myIdx = myUserId ? freshPlayers.findIndex(p => String(Number(p.user_id)) === myUserId || String(p.user_id) === myUserId) : -1;

  let points = null;
  if (freshRoom.status === 'finished' && user) {
    const isWinner = winner && (String(Number(winner)) === myUserId || String(winner) === myUserId);
    points = isWinner ? 50 : 10;
  }

  return json({
    room: { id: freshRoom.id, code: freshRoom.code, mode: freshRoom.mode, status: freshRoom.status, hostId: freshRoom.host_id, hostUsername: hostPlayer ? hostPlayer.username : null, maxPlayers: freshRoom.max_players, speed: freshRoom.speed, isHost: !!isHost, roundsTarget: freshRoom.rounds_target || 3, leftScore: freshRoom.score_left || 0, rightScore: freshRoom.score_right || 0, topScore: freshRoom.score_top || 0, bottomScore: freshRoom.score_bottom || 0 },
    myIndex: myIdx,
    players: freshPlayers.map((p) => ({
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
    return json({ error: 'State error' }, 500);
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

    return await handleState(context, code, user);
  } catch (e) {
    return json({ error: 'State error' }, 500);
  }
}
