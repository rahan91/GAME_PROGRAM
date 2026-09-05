ALTER TABLE scores ADD COLUMN spent INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS purchases (
  user_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  bought_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, item_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS equips (
  user_id INTEGER NOT NULL,
  slot TEXT NOT NULL,
  item_key TEXT NOT NULL,
  PRIMARY KEY (user_id, slot),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);