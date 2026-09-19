CREATE TABLE IF NOT EXISTS site_meta (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);
INSERT OR IGNORE INTO site_meta (key, value) VALUES ('plays_reset_at', '0');
