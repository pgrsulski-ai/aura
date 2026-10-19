/*
# Add is_external column to posts

1. Changes
- Adds `is_external boolean DEFAULT false` to `posts`.
- When true, `media_url` holds an external URL (YouTube / TikTok) and the
  post consumes zero Supabase Storage bytes. When false, `media_url` is a
  Supabase Storage public URL as before.
2. Security
- No RLS changes. Existing posts policies still apply; the column is
  writable by the same authenticated owners who can already insert rows.
3. Notes
- Idempotent: uses DO block to add the column only if it does not exist.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_external'
  ) THEN
    ALTER TABLE posts ADD COLUMN is_external boolean NOT NULL DEFAULT false;
  END IF;
END $$;
