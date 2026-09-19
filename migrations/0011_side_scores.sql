-- Per-side scores for the new scoring system
-- When ball hits a side, all OTHER sides get +1 point
-- score_left and score_right already exist from 0009_pong_score.sql
ALTER TABLE pong_rooms ADD COLUMN score_top INTEGER DEFAULT 0;
ALTER TABLE pong_rooms ADD COLUMN score_bottom INTEGER DEFAULT 0;
