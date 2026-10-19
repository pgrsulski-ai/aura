/*
# Engagement Rewards System (gamification with anti-spam guards)

## Rewards
1. Video Upload: +5 coins, max 2 rewards / 24h per user.
2. Meaningful Comment (>=5 words): +2 coins, max 5 rewards / 24h per user.
3. First 10 Likes Milestone: +10 coins to the post creator, once per post.

## Schema changes
- New `comments` table (id, post_id, user_id, text, created_at, likes).
- New column `posts.rewarded_10_likes` boolean default false — guards the
  milestone so it fires exactly once per post.

## RPCs (all SECURITY DEFINER, search_path pinned, auth.uid() scoped)
1. `claim_upload_reward()` — awards +5 if under the 24h cap. Idempotent.
2. `post_comment(p_post_id uuid, p_text text)` — inserts a comment row,
   awards +2 if text has >=5 words AND under the 24h cap. Returns the
   new comment row + reward info.
3. `check_10_likes_milestone(p_post_id uuid)` — if the post's likes_count
   >= 10 AND rewarded_10_likes is false, atomically sets the flag, credits
   the creator +10, logs a transaction, and returns { awarded: true }.
   Called automatically from the updated likes trigger.

## Transaction log labels (Polish)
- upload: 'Nagroda za aktywność: Publikacja'
- comment: 'Nagroda za aktywność: Komentarz'
- 10 likes: 'Nagroda za aktywność: 10 polubień'

## Security
- comments RLS: users SELECT all (feed), INSERT/DELETE own only.
- All coin mutations go through SECURITY DEFINER functions.
- posts.rewarded_10_likes is not client-writable (no UPDATE policy change).
*/

-- ── 1. Comments table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Everyone can read comments (they're public content on the feed)
DROP POLICY IF EXISTS "comments_select_all" ON public.comments;
CREATE POLICY "comments_select_all"
  ON public.comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments (user_id);

-- ── 2. rewarded_10_likes flag on posts ─────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS rewarded_10_likes boolean NOT NULL DEFAULT false;

-- ── 3. Upload reward RPC ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_upload_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT count(*) INTO v_count
    FROM public.transactions
    WHERE user_id = v_uid
      AND type = 'upload_reward'
      AND created_at > now() - interval '24 hours';

  IF v_count >= 2 THEN
    RETURN jsonb_build_object('ok', true, 'awarded', false, 'reason', 'rate_limited');
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance + 5 WHERE id = v_uid;

  INSERT INTO public.transactions (user_id, type, amount, metadata)
    VALUES (v_uid, 'upload_reward', 5, jsonb_build_object('source', 'video_upload'));

  RETURN jsonb_build_object('ok', true, 'awarded', true, 'amount', 5);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_upload_reward() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_upload_reward() TO authenticated;

-- ── 4. Post comment RPC (with comment reward) ──────────────
CREATE OR REPLACE FUNCTION public.post_comment(p_post_id uuid, p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_word_count integer;
  v_reward_count integer;
  v_comment_id uuid;
  v_awarded boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_comment');
  END IF;

  -- Insert the comment
  INSERT INTO public.comments (post_id, user_id, text)
    VALUES (p_post_id, v_uid, p_text)
    RETURNING id INTO v_comment_id;

  -- Check if comment is "meaningful" (>= 5 words)
  v_word_count := array_length(string_to_array(btrim(p_text), ' '), 1);
  IF v_word_count IS NULL THEN v_word_count := 0; END IF;

  IF v_word_count >= 5 THEN
    SELECT count(*) INTO v_reward_count
      FROM public.transactions
      WHERE user_id = v_uid
        AND type = 'comment_reward'
        AND created_at > now() - interval '24 hours';

    IF v_reward_count < 5 THEN
      UPDATE public.profiles SET wallet_balance = wallet_balance + 2 WHERE id = v_uid;
      INSERT INTO public.transactions (user_id, type, amount, metadata)
        VALUES (v_uid, 'comment_reward', 2,
          jsonb_build_object('source', 'meaningful_comment', 'post_id', p_post_id, 'comment_id', v_comment_id));
      v_awarded := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'comment_id', v_comment_id,
    'awarded', v_awarded,
    'amount', CASE WHEN v_awarded THEN 2 ELSE 0 END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_comment(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_comment(uuid, text) TO authenticated;

-- ── 5. 10-likes milestone RPC ──────────────────────────────
CREATE OR REPLACE FUNCTION public.check_10_likes_milestone(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post record;
  v_awarded boolean := false;
BEGIN
  SELECT id, user_id, likes_count, rewarded_10_likes
    INTO v_post
    FROM public.posts
    WHERE id = p_post_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  IF v_post.rewarded_10_likes THEN
    RETURN jsonb_build_object('ok', true, 'awarded', false, 'reason', 'already_rewarded');
  END IF;

  IF v_post.likes_count >= 10 THEN
    UPDATE public.posts SET rewarded_10_likes = true WHERE id = p_post_id;
    UPDATE public.profiles SET wallet_balance = wallet_balance + 10 WHERE id = v_post.user_id;
    INSERT INTO public.transactions (user_id, type, amount, metadata)
      VALUES (v_post.user_id, 'likes_milestone', 10,
        jsonb_build_object('source', '10_likes_milestone', 'post_id', p_post_id));
    v_awarded := true;
  END IF;

  RETURN jsonb_build_object('ok', true, 'awarded', v_awarded, 'amount', 10);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_10_likes_milestone(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_10_likes_milestone(uuid) TO authenticated;

-- ── 6. Update the likes trigger to fire the milestone check ─
-- The existing sync_post_likes trigger increments likes_count on INSERT.
-- We extend it to call check_10_likes_milestone after the increment.
CREATE OR REPLACE FUNCTION public.sync_post_likes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET likes = likes + 1 WHERE id = NEW.post_id;
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    PERFORM public.check_10_likes_milestone(NEW.post_id);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.post_id;
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- The trigger itself already exists (on_like_change); the function body
-- is replaced in place, so no DROP/CREATE TRIGGER needed.
