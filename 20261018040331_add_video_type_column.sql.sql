/*
# video_type column on posts — Shorts vs Full Tracks

## Summary
- Adds `video_type text NOT NULL DEFAULT 'short'` to posts.
- Allows client INSERT of video_type so creators can choose Short/Full Track.
- Backfills existing rows to 'short'.

## Why
The app needs to distinguish short vertical clips from full-length music
tracks (YouTube Shorts vs normal videos). The default is 'short'.
*/

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS video_type text NOT NULL DEFAULT 'short';

-- Backfill any rows that ended up NULL or default
UPDATE posts SET video_type = 'short' WHERE video_type IS NULL OR video_type = '';

-- Allow creators to set the type on upload. The existing posts_insert_own
-- policy allows the insert; the column-level INSERT grant needs video_type.
REVOKE INSERT ON posts FROM authenticated;
GRANT INSERT (
  user_id, media_url, track_title, caption, genre, ai_prompt, ai_engine,
  overlay_text, overlay_filter, video_type
) ON posts TO authenticated;

NOTIFY pgrst, 'reload schema';
