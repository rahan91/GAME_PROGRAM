-- Add lobby customization fields
ALTER TABLE pong_rooms ADD COLUMN room_name TEXT DEFAULT '';
ALTER TABLE pong_rooms ADD COLUMN is_private INTEGER DEFAULT 0;
ALTER TABLE pong_rooms ADD COLUMN min_players INTEGER DEFAULT 2;

ALTER TABLE tron_rooms ADD COLUMN room_name TEXT DEFAULT '';
ALTER TABLE tron_rooms ADD COLUMN is_private INTEGER DEFAULT 0;
ALTER TABLE tron_rooms ADD COLUMN min_players INTEGER DEFAULT 2;
