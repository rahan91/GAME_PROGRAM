import bcrypt from 'bcryptjs';

const SESSION_COOKIE = 'game_session';
const SESSION_DAYS = 30;
const TOKEN_VERSION = 1;

function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64url(sig);
}

async function hmacVerify(data, sig, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBytes = unb64url(sig);
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
}

function getSecret(env) {
  return env.SESSION_SECRET || env.JWT_SECRET || 'game-program-fallback-secret-key-2024';
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function setSessionCookie(response, token, maxAgeDays = SESSION_DAYS) {
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeDays * 24 * 3600}`
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

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export async function createSession(env, userId) {
  const now = Math.floor(Date.now() / 1000);
  const expires = now + SESSION_DAYS * 24 * 3600;
  const payload = JSON.stringify({ v: TOKEN_VERSION, uid: userId, exp: expires });
  const payloadB64 = b64url(new TextEncoder().encode(payload));
  const sig = await hmacSign(payloadB64, getSecret(env));
  return `${payloadB64}.${sig}`;
}

export async function getUserFromRequest(env, request) {
  const token = getSessionToken(request);
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  try {
    const valid = await hmacVerify(payloadB64, sig, getSecret(env));
    if (!valid) return null;
  } catch { return null; }

  let payload;
  try {
    const raw = new TextDecoder().decode(unb64url(payloadB64));
    payload = JSON.parse(raw);
  } catch { return null; }

  if (!payload.uid || !payload.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  const user = await env.DATABASE.prepare(
    'SELECT id, username, email FROM users WHERE id = ?'
  ).bind(payload.uid).first();
  return user || null;
}
