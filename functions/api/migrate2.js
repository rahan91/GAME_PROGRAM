export async function onRequestPost(context) {
  const db = context.env.DATABASE;
  const stmts = [
    'ALTER TABLE pong_rooms ADD COLUMN last_tick_at INTEGER DEFAULT 0',
    'ALTER TABLE tron_rooms ADD COLUMN last_tick_at INTEGER DEFAULT 0',
  ];
  const results = [];
  for (const sql of stmts) {
    try {
      await db.prepare(sql).run();
      results.push({ sql: sql.slice(0, 60), ok: true });
    } catch (e) {
      results.push({ sql: sql.slice(0, 60), ok: false, error: e.message || String(e) });
    }
  }
  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
}
