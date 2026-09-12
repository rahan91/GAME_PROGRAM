-- Add settings columns to multiplayer rooms
ALTER TABLE pong_rooms ADD COLUMN max_players INTEGER DEFAULT 8;
ALTER TABLE pong_rooms ADD COLUMN speed TEXT DEFAULT 'medium';

ALTER TABLE tron_rooms ADD COLUMN max_players INTEGER DEFAULT 8;
ALTER TABLE tron_rooms ADD COLUMN speed TEXT DEFAULT 'medium';
