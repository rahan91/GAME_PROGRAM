-- Pong multiplayer tables
CREATE TABLE IF NOT EXISTS pong_rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  mode TEXT DEFAULT 'ffa',
  status TEXT DEFAULT 'waiting',
  host_id TEXT,
  winner_id TEXT,
  created_at INTEGER,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS pong_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  user_id TEXT,
  username TEXT,
  rating INTEGER DEFAULT 1200,
  side TEXT,
  paddle_y REAL DEFAULT 0.5,
  alive INTEGER DEFAULT 1,
  ready INTEGER DEFAULT 0,
  dir INTEGER DEFAULT 0,
  color TEXT,
  joined_at INTEGER,
  FOREIGN KEY (room_id) REFERENCES pong_rooms(id)
);

CREATE TABLE IF NOT EXISTS pong_ball (
  room_id TEXT PRIMARY KEY,
  x REAL DEFAULT 0.5,
  y REAL DEFAULT 0.5,
  vx REAL DEFAULT 0.03,
  vy REAL DEFAULT 0.01,
  speed REAL DEFAULT 5,
  FOREIGN KEY (room_id) REFERENCES pong_rooms(id)
);

-- Tron multiplayer tables
CREATE TABLE IF NOT EXISTS tron_rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  status TEXT DEFAULT 'waiting',
  host_id TEXT,
  winner_id TEXT,
  created_at INTEGER,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS tron_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  user_id TEXT,
  username TEXT,
  rating INTEGER DEFAULT 1200,
  x INTEGER,
  y INTEGER,
  dir TEXT,
  alive INTEGER DEFAULT 1,
  ready INTEGER DEFAULT 0,
  color TEXT,
  trail TEXT DEFAULT '[]',
  joined_at INTEGER,
  FOREIGN KEY (room_id) REFERENCES tron_rooms(id)
);

-- ELO ratings
CREATE TABLE IF NOT EXISTS elo_ratings (
  user_id TEXT,
  game TEXT,
  rating INTEGER DEFAULT 1200,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  is_provisional INTEGER DEFAULT 1,
  last_active TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game)
);

CREATE TABLE IF NOT EXISTS elo_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT,
  room_id TEXT,
  winner_id TEXT,
  players TEXT,
  rating_changes TEXT,
  played_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pong_rooms_code ON pong_rooms(code);
CREATE INDEX IF NOT EXISTS idx_pong_rooms_status ON pong_rooms(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pong_players_room ON pong_players(room_id);
CREATE INDEX IF NOT EXISTS idx_pong_players_user ON pong_players(user_id);
CREATE INDEX IF NOT EXISTS idx_tron_rooms_code ON tron_rooms(code);
CREATE INDEX IF NOT EXISTS idx_tron_rooms_status ON tron_rooms(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_tron_players_room ON tron_players(room_id);
CREATE INDEX IF NOT EXISTS idx_tron_players_user ON tron_players(user_id);
CREATE INDEX IF NOT EXISTS idx_elo_ratings_game ON elo_ratings(game, rating DESC);
