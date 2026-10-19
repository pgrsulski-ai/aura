-- Drop the posts→profiles FK we added earlier. It created an ambiguous
-- relationship (posts.user_id has FKs to both auth.users and profiles),
-- which breaks PostgREST's nested join resolution. Profiles are fetched
-- separately via fetchProfilesBatch instead.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_profiles_fkey;
