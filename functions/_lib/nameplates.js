import { getItem } from './catalog.js';

export async function attachNameplates(env, rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => '?').join(', ');
  const eq = await env.DATABASE.prepare(
    `SELECT user_id, item_key FROM equips WHERE slot = 'nameplate' AND user_id IN (${ph})`
  ).bind(...ids).all();
  const byUser = {};
  for (const e of eq.results) {
    const it = getItem(e.item_key);
    if (!it) continue;
    if (it.colors) byUser[e.user_id] = { colors: it.colors, speed: it.speed || null };
    else if (it.color) byUser[e.user_id] = { color: it.color };
  }
  const def = getItem('nameplate:default');
  for (const r of rows) {
    const v = byUser[r.id];
    if (v) {
      r.nameplate = v.color || null;
      r.nameplateColors = v.colors || null;
      r.nameplateSpeed = v.speed || null;
    } else {
      r.nameplate = (def && def.color) || '#828282';
    }
  }
  return rows;
}