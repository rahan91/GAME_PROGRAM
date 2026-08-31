import { json, getUserFromRequest } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const user = await getUserFromRequest(context.env, context.request);
  return json({ user });
}
