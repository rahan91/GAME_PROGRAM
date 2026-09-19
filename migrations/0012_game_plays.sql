CREATE TABLE IF NOT EXISTS game_plays (
  game TEXT PRIMARY KEY,
  plays INTEGER DEFAULT 0,
  last_updated INTEGER DEFAULT 0
);
INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('maze', 0, 0);
INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('target', 0, 0);
INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('button', 0, 0);
INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('cut', 0, 0);
INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('circle', 0, 0);
INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('pong', 0, 0);
INSERT OR IGNORE INTO game_plays (game, plays, last_updated) VALUES ('tron', 0, 0);
