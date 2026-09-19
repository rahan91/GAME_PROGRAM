import { json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DATABASE;
    let rows;
    try {
      rows = await db.prepare('SELECT game, plays FROM game_plays ORDER BY plays DESC').all();
    } catch {
      return json({});
    }
    const result = {};
    for (const r of (rows.results || [])) {
      result[r.game] = r.plays;
    }
    return json(result);
  } catch (e) {
    return json({});
  }
}

export async function onRequestPost(context) {
  try {
    let body;
    try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }
    const game = body && body.game ? String(body.game).toLowerCase() : null;
    if (!game) return json({ error: 'Missing game' }, 400);

    const db = context.env.DATABASE;
    try {
      await db.prepare('UPDATE game_plays SET plays = plays + 1, last_updated = ? WHERE game = ?')
        .bind(Math.floor(Date.now() / 1000), game).run();
    } catch {}

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Track error' }, 500);
  }
}
