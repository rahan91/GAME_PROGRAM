import bcrypt from 'bcryptjs';

const SESSION_COOKIE = 'game_session';
const SESSION_DAYS = 30;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function setSessionCookie(response, token, maxAgeDays = SESSION_DAYS) {
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeDays * 24 * 3600}`
  );
}

export function clearSessionCookie(response) {
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}

export function getSessionToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)game_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function hashToken(token) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(data)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function generateToken() {
  return crypto.randomUUID() + crypto.randomUUID();
}

export async function createSession(env, userId) {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);
  const expires = now + SESSION_DAYS * 24 * 3600;
  await env.DATABASE.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(tokenHash, userId, now, expires).run();
  return token;
}

export async function getUserFromRequest(env, request) {
  const token = getSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const row = await env.DATABASE.prepare(
    `SELECT u.id, u.username, u.email
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > unixepoch()`
  ).bind(tokenHash).first();
  return row || null;
}
