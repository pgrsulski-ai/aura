-- Add FK from posts.user_id to profiles.id so PostgREST can resolve
-- the posts(*, profiles(*)) nested join in the likes query.
-- profiles.id already references auth.users(id), and posts.user_id
-- also references auth.users(id), so this is a valid additional FK.
ALTER TABLE posts
  ADD CONSTRAINT posts_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
