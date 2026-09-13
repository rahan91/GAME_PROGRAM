-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  left_handed INTEGER DEFAULT 0,
  cursor_style TEXT DEFAULT 'default',
  auto_ready INTEGER DEFAULT 0
);

-- Tron dynamic grid
ALTER TABLE tron_rooms ADD COLUMN grid_w INTEGER DEFAULT 640;
ALTER TABLE tron_rooms ADD COLUMN grid_h INTEGER DEFAULT 480;

-- Pong rounds system
ALTER TABLE pong_rooms ADD COLUMN rounds_target INTEGER DEFAULT 3;
ALTER TABLE pong_rooms ADD COLUMN round_num INTEGER DEFAULT 0;
