import { json, clearSessionCookie } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export async function onRequestGet(context) {
  const { getUserFromRequest } = await import('../_lib/auth.js');
  const user = await getUserFromRequest(context.env, context.request);
  return json({ user });
}
