/*
# Create posts table for user-uploaded video tracks

## Summary
Creates the `posts` table that stores every video track a user publishes through Aura Studio.
Each row holds the track metadata (title, caption, genre, AI prompt/engine), the creator's
edits (text overlay + CSS filter), and the Supabase Storage public URL of the uploaded media.
The table is owner-scoped: every post belongs to the authenticated user who created it.

## New Tables
- `posts`
  - `id` uuid PK (default gen_random_uuid)
  - `user_id` uuid NOT NULL — author; defaults to the authenticated user via auth.uid()
  - `media_url` text NOT NULL — public URL of the video file in the `aura-media` storage bucket
  - `track_title` text NOT NULL — display title of the track
  - `caption` text — optional description
  - `genre` text — optional genre tag
  - `ai_prompt` text — the prompt used to generate the track
  - `ai_engine` text — engine/version used (e.g. Suno v3.5)
  - `overlay_text` text — creator's text overlay applied to the video
  - `overlay_filter` text — creator's CSS filter choice (normal|grayscale|sepia|contrast|vintage)
  - `likes` integer NOT NULL default 0 — cached like count
  - `created_at` timestamptz default now()

## Security (Row Level Security)
- RLS enabled on `posts`.
- SELECT: public — anyone (anon + authenticated) can read all posts so the feed works for logged-out users.
- INSERT: authenticated only, and the row's user_id must equal the caller's auth.uid().
- UPDATE: authenticated only, owner only. Allows editing title/caption and likes increment.
- DELETE: authenticated only, owner only. Lets a creator remove their own post.

## Important notes
1. `user_id` defaults to auth.uid() so inserts that omit it succeed under RLS.
2. likes is a simple cached counter for now; a dedicated likes table can be added later.
3. overlay_filter stores the filter id string ('grayscale', 'sepia', etc.); the frontend maps it to CSS.
*/

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  track_title text NOT NULL,
  caption text DEFAULT '',
  genre text DEFAULT '',
  ai_prompt text DEFAULT '',
  ai_engine text DEFAULT '',
  overlay_text text DEFAULT '',
  overlay_filter text DEFAULT 'normal',
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- SELECT: public read for everyone (feed works for logged-out users too)
DROP POLICY IF EXISTS "posts_select_all" ON posts;
CREATE POLICY "posts_select_all"
  ON posts FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: only authenticated owner
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: only authenticated owner (edit title/caption, increment likes)
DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only authenticated owner
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for feed ordering
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);
