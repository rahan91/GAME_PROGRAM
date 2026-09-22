import { json, getUserFromRequest } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const password = body && body.password;
  if (!password || password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(password, 10);

  await context.env.DATABASE.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run();

  return json({ ok: true });
}
