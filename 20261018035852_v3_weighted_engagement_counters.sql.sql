/*
# V3 Weighted Engagement Algorithm — counter columns + triggers

## Summary
- Adds likes_count, comments_count, shares_count, saves_count (int default 0)
  to posts. These feed the weighted engagement score used to sort Discover.
- Backfills likes_count from the existing likes column.
- Extends sync_post_likes to also bump likes_count; adds sync_post_saves
  trigger on saved_posts to bump saves_count.
- Counts are maintained server-side by triggers (not client-writable), so a
  crafted request cannot inflate ranking. The column lockdown already
  restricts UPDATE on posts to a few content columns.

## Why
The browser is untrusted. Letting the client increment score columns directly
would let anyone manipulate feed ranking. Triggers fire on real like/save row
inserts/deletes (the existing toggle actions), so counts stay honest.
*/

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0;

-- Backfill likes_count from the existing denormalized likes column
UPDATE posts SET likes_count = likes WHERE likes_count = 0;

-- Extend the existing likes trigger to also keep likes_count in sync
CREATE OR REPLACE FUNCTION public.sync_post_likes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts
      SET likes = likes + 1,
          likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts
      SET likes = GREATEST(likes - 1, 0),
          likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- New trigger function for saves_count
CREATE OR REPLACE FUNCTION public.sync_post_saves()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts SET saves_count = saves_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_save_change ON saved_posts;
CREATE TRIGGER on_save_change
  AFTER INSERT OR DELETE ON saved_posts
  FOR EACH ROW EXECUTE FUNCTION sync_post_saves();

NOTIFY pgrst, 'reload schema';
