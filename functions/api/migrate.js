export async function onRequestPost(context) {
  const db = context.env.DATABASE;
  const results = [];

  const stmts = [
    'CREATE TABLE IF NOT EXISTS user_settings (user_id TEXT PRIMARY KEY, left_handed INTEGER DEFAULT 0, cursor_style TEXT DEFAULT \'default\', auto_ready INTEGER DEFAULT 0)',
    'ALTER TABLE pong_rooms ADD COLUMN rounds_target INTEGER DEFAULT 3',
    'ALTER TABLE pong_rooms ADD COLUMN round_num INTEGER DEFAULT 0',
    'ALTER TABLE tron_rooms ADD COLUMN grid_w INTEGER DEFAULT 640',
    'ALTER TABLE tron_rooms ADD COLUMN grid_h INTEGER DEFAULT 480',
  ];

  for (const sql of stmts) {
    try {
      await db.prepare(sql).run();
      results.push({ sql: sql.slice(0, 60), ok: true });
    } catch (e) {
      results.push({ sql: sql.slice(0, 60), ok: false, error: e.message || String(e) });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
