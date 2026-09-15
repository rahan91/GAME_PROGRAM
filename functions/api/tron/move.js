import { json, getUserFromRequest } from '../../_lib/auth.js';

const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export async function onRequestPost(context) {
  try {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const code = body && body.room ? String(body.room).toUpperCase() : null;
  const dir = body && body.dir ? String(body.dir).toLowerCase() : null;

  if (!code) return json({ error: 'Missing room' }, 400);
  if (!dir || !VALID_DIRS.has(dir)) return json({ error: 'Invalid direction' }, 400);

  const db = context.env.DATABASE;

  const player = await db.prepare(
    "SELECT dir FROM tron_players WHERE room_id = (SELECT id FROM tron_rooms WHERE code = ? AND status = 'playing') AND user_id = ?"
  ).bind(code, user.id).first();

  if (!player) return json({ error: 'Not in active game' }, 400);
  if (player.dir && player.dir !== '' && player.dir === OPPOSITE[dir]) return json({ error: 'Cannot reverse' }, 400);

  await db.prepare(
    "UPDATE tron_players SET dir = ? WHERE room_id = (SELECT id FROM tron_rooms WHERE code = ? AND status = 'playing') AND user_id = ?"
  ).bind(dir, code, user.id).run();

  return json({ ok: true, dir });
  } catch (e) {
    return json({ error: 'Move error' }, 500);
  }
}
