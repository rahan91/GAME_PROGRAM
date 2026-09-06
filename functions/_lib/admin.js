import { getUserFromRequest } from './auth.js';

export const ADMIN_USERNAME = 'ruruskaado';

export async function getAdminUser(env, request) {
  const user = await getUserFromRequest(env, request);
  if (!user || String(user.username).toLowerCase() !== ADMIN_USERNAME) return null;
  return user;
}