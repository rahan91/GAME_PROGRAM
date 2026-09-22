import { json } from '../_lib/auth.js';
import { checkRateLimit } from '../_lib/moderation.js';

const RESET_INTERVAL = 3600;

export async function onRequestGet(context) {
  try {
    const db = context.env.DATABASE;

    let meta;
    try {
      meta = await db.prepare('SELECT value FROM site_meta WHERE key = ?').bind('plays_reset_at').first();
    } catch { meta = null; }

    const now = Math.floor(Date.now() / 1000);
    const lastReset = meta ? Number(meta.value) : 0;

    if (now - lastReset >= RESET_INTERVAL) {
      try {
        await db.prepare('UPDATE game_plays SET plays = 0').run();
      } catch {}
      try {
        await db.prepare('INSERT INTO site_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
          .bind('plays_reset_at', String(now)).run();
      } catch {}
    }

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
    const ip = context.request.headers.get('cf-connecting-ip') || 'unknown';
    if (!checkRateLimit('plays:' + ip, 60, 60000)) {
      return json({ error: 'Too many requests' }, 429);
    }

    let body;
    try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }
    const game = body && body.game ? String(body.game).toLowerCase() : null;
    if (!game) return json({ error: 'Missing game' }, 400);

    const db = context.env.DATABASE;
    await db.prepare(
      'INSERT INTO game_plays (game, plays, last_updated) VALUES (?, 1, ?) ON CONFLICT(game) DO UPDATE SET plays = plays + 1, last_updated = excluded.last_updated'
    ).bind(game, Math.floor(Date.now() / 1000)).run();

    return json({ ok: true });
  } catch (e) {
    return json({ track_error: 'Track error' }, 500);
  }
}
