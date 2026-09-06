-- Per-game leaderboard stats, recorded from the moment this migration ships.
CREATE TABLE IF NOT EXISTS game_stats (
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  game TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  best INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_stats_total ON game_stats(game, total DESC);
CREATE INDEX IF NOT EXISTS idx_game_stats_best ON game_stats(game, best DESC);