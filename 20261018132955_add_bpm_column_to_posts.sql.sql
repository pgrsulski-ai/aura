-- Add bpm column to posts for tempo metadata on uploaded tracks
ALTER TABLE posts ADD COLUMN IF NOT EXISTS bpm integer;
