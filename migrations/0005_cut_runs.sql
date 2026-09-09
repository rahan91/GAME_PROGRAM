-- Per-cut accuracy runs, enabling a per-difficulty accuracy leaderboard and
-- an exact percentile for each player's best accuracy on each difficulty.
CREATE TABLE IF NOT EXISTS cut_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  accuracy REAL NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  elapsed REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cut_runs_difficulty ON cut_runs(difficulty);
CREATE INDEX IF NOT EXISTS idx_cut_runs_acc ON cut_runs(difficulty, accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_cut_runs_created ON cut_runs(created_at);