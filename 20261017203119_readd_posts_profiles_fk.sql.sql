/*
# Re-add posts to profiles FK for nested join support

## Summary
Re-creates the foreign key from posts.user_id to profiles.id so that
PostgREST nested joins like `saved_posts.select('posts(*, profiles(*))')`
can resolve the posts→profiles relationship.

This FK was previously dropped because it created an ambiguous relationship
with the existing posts.user_id → auth.users FK. The ambiguity only affects
tables that join to posts via user_id (like likes). saved_posts joins to
posts via post_id (only one FK), so the nested profiles(*) inside posts
is unambiguous from the saved_posts perspective.

## Changes
- Add FK: posts.user_id REFERENCES profiles(id) ON DELETE CASCADE
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_user_id_profiles_fkey' AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT posts_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
