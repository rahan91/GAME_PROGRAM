import { json, hashPassword, createSession, setSessionCookie } from '../_lib/auth.js';
import { hasProfanity, checkRateLimit } from '../_lib/moderation.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!checkRateLimit('register:' + ip, 3, 60000)) {
      return json({ error: 'Too many attempts. Wait a minute.' }, 429);
    }

    const username = (body.username || '').trim();
    const email = (body.email || '').trim() || null;
    const password = body.password || '';

    if (!username || username.length < 3 || username.length > 24) {
      return json({ error: 'Username must be 3-24 characters' }, 400);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return json({ error: 'Username may only contain letters, numbers, and underscores' }, 400);
    }
    if (hasProfanity(username)) {
      return json({ error: 'Username contains blocked words' }, 400);
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    if (username.toLowerCase() === 'ruruskaado') {
      return json({ error: 'Username reserved' }, 409);
    }

    const existing = await env.DATABASE.prepare(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR (email IS NOT NULL AND email = ?)'
    ).bind(username, email).first();
    if (existing) {
      return json({ error: 'Username or email already taken' }, 409);
    }

    const passwordHash = hashPassword(password);

    const result = await env.DATABASE.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).bind(username, email, passwordHash).run();

    const userId = result.meta.last_row_id;

    const token = await createSession(env, userId);
    const response = json({ user: { id: userId, username, email } }, 201);
    setSessionCookie(response, token);
    return response;
  } catch (e) {
    return json({ error: 'Server error' }, 500);
  }
}
