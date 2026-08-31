import { json, getUserFromRequest, getSessionToken, hashToken, clearSessionCookie } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const token = getSessionToken(request);
  if (token) {
    const tokenHash = await hashToken(token);
    await env.DATABASE.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export async function onRequestGet(context) {
  const user = await getUserFromRequest(context.env, context.request);
  return json({ user });
}
