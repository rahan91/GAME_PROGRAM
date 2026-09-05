-- Universal leaderboard: one running total per user across all games.
CREATE TABLE IF NOT EXISTS scores (
  user_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scores_total ON scores(total);