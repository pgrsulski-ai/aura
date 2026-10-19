-- Fix: authenticated role was missing INSERT/UPDATE table privileges on posts.
-- RLS policies are evaluated only after GRANTs pass, so even a correct INSERT
-- policy ("auth.uid() = user_id") was unreachable, causing
-- "permission denied for table posts (42501)" on upload.
-- The anon role already had full grants; align authenticated to match.

GRANT INSERT ON public.posts TO authenticated;
GRANT UPDATE ON public.posts TO authenticated;

-- Allow authenticated to set all insertable columns (including bpm) via insert.
-- Column-level grants default to allowing all columns of an allowed statement,
-- but we restate explicitly to keep the lock-down intact for updates:
-- updates remain restricted to editable display fields only.
REVOKE UPDATE (user_id, media_url, genre, ai_prompt, ai_engine, video_type, bpm,
                likes, views, boost_multiplier, likes_count, comments_count,
                shares_count, saves_count, created_at) ON public.posts FROM authenticated;
