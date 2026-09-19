import { json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DATABASE;

    const stmts = [
      "ALTER TABLE pong_rooms ADD COLUMN score_top INTEGER DEFAULT 0",
      "ALTER TABLE pong_rooms ADD COLUMN score_bottom INTEGER DEFAULT 0",
      "ALTER TABLE pong_rooms ADD COLUMN score_left INTEGER DEFAULT 0",
      "ALTER TABLE pong_rooms ADD COLUMN score_right INTEGER DEFAULT 0",
      "CREATE TABLE IF NOT EXISTS game_plays (game TEXT PRIMARY KEY, plays INTEGER DEFAULT 0, last_updated INTEGER DEFAULT 0)",
      "INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('maze', 0, 0)",
      "INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('target', 0, 0)",
      "INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('button', 0, 0)",
      "INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('cut', 0, 0)",
      "INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('circle', 0, 0)",
      "INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('pong', 0, 0)",
      "INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('tron', 0, 0)",
    ];

    const results = [];
    for (const sql of stmts) {
      try {
        await db.prepare(sql).run();
        results.push({ sql: sql.substring(0, 50), ok: true });
      } catch (e) {
        results.push({ sql: sql.substring(0, 50), error: e.message });
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
