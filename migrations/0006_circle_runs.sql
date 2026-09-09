-- Per-circle accuracy runs, enabling an accuracy-only leaderboard with an exact
-- percentile for each player's best accuracy. Single mode, so no difficulty column.
CREATE TABLE IF NOT EXISTS circle_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  accuracy REAL NOT NULL,
  coverage REAL NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  elapsed REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_circle_runs_acc ON circle_runs(accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_circle_runs_user ON circle_runs(user_id, accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_circle_runs_created ON circle_runs(created_at);