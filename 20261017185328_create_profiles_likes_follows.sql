/*
# Create profiles, likes, and follows tables

## Summary
Adds three new tables to support real user identities and social interactions:
- `profiles` — stores each user's display handle, bio, and avatar, linked 1:1 to auth.users.
- `likes` — records a user liking a specific post (unique per user+post).
- `follows` — records a user following another user (unique per follower+followee).

These replace the hardcoded "Creator" handle and the local-only like/follow state.

## New Tables

### profiles
- `id` uuid PK — matches auth.users.id (1:1), ON DELETE CASCADE
- `handle` text NOT NULL UNIQUE — the display username shown on posts
- `bio` text default '' — short bio shown on profile
- `avatar_url` text default NULL — optional avatar image URL
- `created_at` timestamptz default now()

### likes
- `id` uuid PK default gen_random_uuid
- `user_id` uuid NOT NULL DEFAULT auth.uid() — who liked, FK to auth.users ON DELETE CASCADE
- `post_id` uuid NOT NULL — which post, FK to posts ON DELETE CASCADE
- `created_at` timestamptz default now()
- UNIQUE(user_id, post_id) — one like per user per post

### follows
- `id` uuid PK default gen_random_uuid
- `follower_id` uuid NOT NULL DEFAULT auth.uid() — who is following, FK to auth.users ON DELETE CASCADE
- `followee_id` uuid NOT NULL — who is being followed, FK to auth.users ON DELETE CASCADE
- `created_at` timestamptz default now()
- UNIQUE(follower_id, followee_id) — one follow per pair
- CHECK (follower_id != followee_id) — can't follow yourself

## Security (Row Level Security)

### profiles
- SELECT: public (anon + authenticated) — anyone can see profiles
- INSERT: authenticated only, must insert own profile (auth.uid() = id)
- UPDATE: authenticated only, own profile only
- DELETE: authenticated only, own profile only

### likes
- SELECT: public (anon + authenticated) — like counts are public
- INSERT: authenticated only, must like as yourself (auth.uid() = user_id)
- DELETE: authenticated only, can only remove your own like

### follows
- SELECT: public (anon + authenticated) — follow relationships are public
- INSERT: authenticated only, must follow as yourself (auth.uid() = follower_id)
- DELETE: authenticated only, can only unfollow yourself (auth.uid() = follower_id)

## Important notes
1. profiles.id defaults to auth.uid() so a user can insert their own row on signup.
2. likes.user_id and follows.follower_id default to auth.uid() so client inserts omitting them still pass RLS.
3. A trigger auto-creates a profile row when a new auth.user signs up (handle from user_metadata).
4. The posts.likes column is kept as a denormalized counter; a trigger on the likes table keeps it in sync.
5. followee_id has no DEFAULT — the client must always pass it explicitly.
*/

-- ── profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL UNIQUE,
  bio text DEFAULT '',
  avatar_url text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- ── likes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all" ON likes;
CREATE POLICY "likes_select_all"
  ON likes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_own" ON likes;
CREATE POLICY "likes_delete_own"
  ON likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── follows ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, followee_id),
  CHECK (follower_id != followee_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select_all" ON follows;
CREATE POLICY "follows_select_all"
  ON follows FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS likes_post_id_idx ON likes (post_id);
CREATE INDEX IF NOT EXISTS likes_user_id_idx ON likes (user_id);
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_followee_id_idx ON follows (followee_id);

-- ── Trigger: auto-create profile on signup ────────────────
-- Uses raw_user_meta_data->>'handle' (set by AuthScreen signUp).
-- Falls back to the email local-part if no handle was provided.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, handle)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'handle', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Trigger: keep posts.likes in sync with likes table ────
CREATE OR REPLACE FUNCTION public.sync_post_likes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_like_change ON likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes();
