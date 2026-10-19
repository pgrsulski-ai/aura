/*
# Create saved_posts table

## Summary
Adds a new table to support the "Saved" (bookmarks) feature, letting users
save posts they want to revisit later. This replaces the "Liked" tab on the
profile with a "Saved" tab.

## New Table: saved_posts
- `id` uuid PK default gen_random_uuid
- `user_id` uuid NOT NULL DEFAULT auth.uid() — who saved the post, FK to auth.users ON DELETE CASCADE
- `post_id` uuid NOT NULL — which post was saved, FK to posts ON DELETE CASCADE
- `created_at` timestamptz default now()
- UNIQUE(user_id, post_id) — one save per user per post

## Security (RLS)
- SELECT: public (anon + authenticated) — save relationships are visible
- INSERT: authenticated only, must save as yourself (auth.uid() = user_id)
- DELETE: authenticated only, can only remove your own saves

## Notes
1. user_id defaults to auth.uid() so client inserts omitting it still pass RLS.
2. No trigger needed — saved posts are not a counter, just a relationship.
3. Indexes on user_id and post_id for query performance.
*/

CREATE TABLE IF NOT EXISTS saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_posts_select_all" ON saved_posts;
CREATE POLICY "saved_posts_select_all"
  ON saved_posts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "saved_posts_insert_own" ON saved_posts;
CREATE POLICY "saved_posts_insert_own"
  ON saved_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_posts_delete_own" ON saved_posts;
CREATE POLICY "saved_posts_delete_own"
  ON saved_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_posts_user_id_idx ON saved_posts (user_id);
CREATE INDEX IF NOT EXISTS saved_posts_post_id_idx ON saved_posts (post_id);
