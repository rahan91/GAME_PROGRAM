import { json, verifyPassword, createSession, setSessionCookie } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const login = (body.login || '').trim();
  const password = body.password || '';

  if (!login || !password) {
    return json({ error: 'Login and password are required' }, 400);
  }

  const user = await env.DATABASE.prepare(
    'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?'
  ).bind(login, login).first();

  if (!user || !verifyPassword(password, user.password_hash)) {
    return json({ error: 'Invalid login or password' }, 401);
  }

  const token = await createSession(env, user.id);
  const response = json({ user: { id: user.id, username: user.username, email: user.email } });
  setSessionCookie(response, token);
  return response;
}
