-- Add more settings columns
ALTER TABLE user_settings ADD COLUMN show_trail INTEGER DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN animations INTEGER DEFAULT 1;
