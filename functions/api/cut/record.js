import { json, getUserFromRequest } from '../../_lib/auth.js';

const DIFFICULTIES = { easy: 1, normal: 1, hard: 1, harder: 1, insane: 1 };
const MAX_ACCURACY = 1.00001;

export async function onRequestPost(context) {
  const user = await getUserFromRequest(context.env, context.request);
  if (!user) return json({ error: 'Not logged in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const difficulty = String((body && body.difficulty) || '').toLowerCase();
  if (!DIFFICULTIES[difficulty]) return json({ error: 'Invalid difficulty' }, 400);

  const accuracy = Number(body && body.accuracy);
  if (!Number.isFinite(accuracy)) return json({ error: 'Accuracy must be a number' }, 400);
  const acc = Math.max(0, Math.min(MAX_ACCURACY, accuracy));

  const points = Math.max(0, Math.round(Number((body && body.points) || 0)) || 0);
  const elapsed = Number(body && body.elapsed);
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;

  const now = Math.floor(Date.now() / 1000);
  await context.env.DATABASE.prepare(
    `INSERT INTO cut_runs (user_id, username, difficulty, accuracy, points, elapsed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, user.username, difficulty, acc, points, time, now).run();

  return json({ difficulty, accuracy: acc });
}