/*
# Cumulative multi-user SuperLikes (tipping system)

## Summary
Overhauls the SuperLike into a cumulative tipping system: multiple different
users (and the same user repeatedly) can SuperLike the same post. Cost lowered
from 100 to 10 Aura Coins. 80% creator cut (8 coins tipped, 2 destroyed).

## 1. New table: super_likes
- `id` uuid PK
- `post_id` uuid FK → posts, CASCADE
- `sender_id` uuid FK → auth.users, CASCADE
- `amount` integer (coins spent, default 10)
- `boost_value` numeric (ranking weight added, default 15)
- `created_at` timestamptz default now()
- NO unique constraint on (sender_id, post_id) — the same user may tip the
  same post multiple times. Multiple users may tip the same post.
- RLS enabled; sender can read only their own rows.

## 2. Updated RPC: send_superlike(target_post_id uuid) RETURNS json
- Cost = 10 coins, boost_value = 15.0, creator cut = 80% (8 coins).
- Deducts 10 from sender, credits 8 to author, 2 destroyed.
- Inserts a super_likes row for every tip (cumulative).
- Increments posts.superlikes_count and posts.boost_score.
- Logs two transactions rows (sent -10, received +8).
- Returns { success, remaining_coins, superlikes_count }.

## 3. Trending
- No schema change needed; fetchTrendingPosts ordering is fixed client-side
  to sort by boost_score (which accumulates from every SuperLike).

## Security
- send_superlike is SECURITY DEFINER, search_path pinned, auth.uid() scoped.
- super_likes RLS: sender SELECT own rows only. No client INSERT/UPDATE/DELETE.
*/

CREATE TABLE IF NOT EXISTS public.super_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 10,
  boost_value numeric NOT NULL DEFAULT 15.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_likes_select_own" ON public.super_likes;
CREATE POLICY "super_likes_select_own"
  ON public.super_likes FOR SELECT
  TO authenticated USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_super_likes_post_id ON public.super_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_super_likes_sender_id ON public.super_likes (sender_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.send_superlike(target_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_id uuid := auth.uid();
  author_id uuid;
  sender_balance integer;
  cost integer := 10;
  creator_cut integer := 8;
  boost_value numeric := 15.0;
  new_count integer;
BEGIN
  IF sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT user_id INTO author_id FROM public.posts WHERE id = target_post_id;
  IF author_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;

  IF author_id = sender_id THEN
    RETURN json_build_object('success', false, 'error', 'You cannot SuperLike your own post');
  END IF;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance - cost
    WHERE id = sender_id AND wallet_balance >= cost
    RETURNING wallet_balance INTO sender_balance;

  IF sender_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient Aura Coins');
  END IF;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance + creator_cut
    WHERE id = author_id;

  UPDATE public.posts
    SET
      superlikes_count = superlikes_count + 1,
      boost_score = boost_score + boost_value,
      last_boosted_at = now()
    WHERE id = target_post_id
    RETURNING superlikes_count INTO new_count;

  INSERT INTO public.super_likes (post_id, sender_id, amount, boost_value)
    VALUES (target_post_id, sender_id, cost, boost_value);

  INSERT INTO public.transactions (user_id, type, amount, metadata)
    VALUES (sender_id, 'superlike_sent', -cost,
      jsonb_build_object('post_id', target_post_id, 'to_user', author_id));

  INSERT INTO public.transactions (user_id, type, amount, metadata)
    VALUES (author_id, 'superlike_received', creator_cut,
      jsonb_build_object('post_id', target_post_id, 'from_user', sender_id));

  RETURN json_build_object('success', true, 'remaining_coins', sender_balance, 'superlikes_count', new_count);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_superlike(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_superlike(uuid) TO authenticated;
