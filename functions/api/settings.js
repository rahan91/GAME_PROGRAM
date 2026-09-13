import { json, getUserFromRequest } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  const db = context.env.DATABASE;
  const settings = await db.prepare(
    'SELECT left_handed, cursor_style, auto_ready FROM user_settings WHERE user_id = ?'
  ).bind(user.id).first();

  return json({
    leftHanded: settings ? !!settings.left_handed : false,
    cursorStyle: settings ? settings.cursor_style : 'default',
    autoReady: settings ? !!settings.auto_ready : false,
  });
}

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const db = context.env.DATABASE;
  const leftHanded = body && body.leftHanded !== undefined ? (body.leftHanded ? 1 : 0) : null;
  const cursorStyle = body && body.cursorStyle ? String(body.cursorStyle) : null;
  const autoReady = body && body.autoReady !== undefined ? (body.autoReady ? 1 : 0) : null;

  const existing = await db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').bind(user.id).first();

  if (existing) {
    const sets = [];
    const vals = [];
    if (leftHanded !== null) { sets.push('left_handed = ?'); vals.push(leftHanded); }
    if (cursorStyle !== null) { sets.push('cursor_style = ?'); vals.push(cursorStyle); }
    if (autoReady !== null) { sets.push('auto_ready = ?'); vals.push(autoReady); }
    if (sets.length > 0) {
      vals.push(user.id);
      await db.prepare(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = ?`).bind(...vals).run();
    }
  } else {
    await db.prepare(
      'INSERT INTO user_settings (user_id, left_handed, cursor_style, auto_ready) VALUES (?, ?, ?, ?)'
    ).bind(
      user.id,
      leftHanded !== null ? leftHanded : 0,
      cursorStyle || 'default',
      autoReady !== null ? autoReady : 0
    ).run();
  }

  const updated = await db.prepare(
    'SELECT left_handed, cursor_style, auto_ready FROM user_settings WHERE user_id = ?'
  ).bind(user.id).first();

  return json({
    ok: true,
    leftHanded: !!updated.left_handed,
    cursorStyle: updated.cursor_style,
    autoReady: !!updated.auto_ready,
  });
}
