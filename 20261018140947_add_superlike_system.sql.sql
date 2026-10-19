/*
# SuperLike System — 100 coin cost, 1.5x boost, coin tipping

## Summary
Adds a SuperLike feature: any authenticated user can spend 100 Aura Coins to
"superlike" a post. The 100 coins are tipped to the post's author (not
destroyed), the post's algorithmic ranking score increases by 150 (1.5x the
100-point self-boost weight), and a transactions log records the transfer.

## New Columns on `posts`
1. `superlikes_count` (integer, not null, default 0) — how many SuperLikes the post has received.
2. `boost_score` (numeric, not null, default 0) — additive algorithmic ranking weight. A self-boost adds 100.0; a SuperLike adds 150.0.
3. `last_boosted_at` (timestamptz, nullable) — timestamp of the most recent boost/superlike, for tie-breaking and recency.

## New Table: `transactions`
- `id` (uuid PK)
- `user_id` (uuid, FK to auth.users, CASCADE) — the user the row belongs to
- `type` (text) — e.g. 'superlike_sent', 'superlike_received'
- `amount` (integer) — coins moved (negative for outgoing, positive for incoming)
- `metadata` (jsonb) — context: post_id, from_user / to_user
- `created_at` (timestamptz, default now())
RLS enabled. Users can SELECT only their own rows. No client INSERT/UPDATE/DELETE — all writes go through the SECURITY DEFINER `send_superlike` function.

## New RPC: `send_superlike(target_post_id uuid) RETURNS json`
SECURITY DEFINER, search_path pinned to public. Validates:
- Caller is authenticated.
- Caller has >= 100 wallet_balance.
- Target post exists.
Then atomically:
- Deducts 100 from caller's wallet_balance.
- Credits 100 to the post author's wallet_balance.
- Increments superlikes_count and adds 150.0 to boost_score on the post.
- Inserts two transaction log rows (sent + received).
Returns { success: true, remaining_coins: <new balance> }.

## Security
- RLS enabled on `transactions`; SELECT-only for authenticated users, scoped to own rows.
- `send_superlike` is SECURITY DEFINER so it can write to `transactions` and update other users' `wallet_balance` — the client cannot do these directly.
- No new grants on `posts` columns beyond what already exists.
*/

-- 1. Add columns to posts (idempotent)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS superlikes_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS boost_score numeric NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS last_boosted_at timestamptz;

-- 2. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount integer NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — all writes go through send_superlike (SECURITY DEFINER).

-- Index for querying a user's transaction history
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id, created_at DESC);

-- 3. Create send_superlike RPC
CREATE OR REPLACE FUNCTION public.send_superlike(target_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  sender_id uuid := auth.uid();
  author_id uuid;
  sender_balance integer;
  cost integer := 100;
  superlike_boost_value numeric := 150.0;
BEGIN
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get post author
  SELECT user_id INTO author_id FROM posts WHERE id = target_post_id;
  IF author_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Prevent superliking your own post
  IF author_id = sender_id THEN
    RAISE EXCEPTION 'You cannot SuperLike your own post';
  END IF;

  -- Atomic balance check + deduction
  UPDATE profiles
  SET wallet_balance = wallet_balance - cost
  WHERE id = sender_id
    AND wallet_balance >= cost
  RETURNING wallet_balance INTO sender_balance;

  IF sender_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient Aura Coins';
  END IF;

  -- Tip: credit 100 coins to the post author
  UPDATE profiles
  SET wallet_balance = wallet_balance + cost
  WHERE id = author_id;

  -- Update post metrics
  UPDATE posts
  SET
    superlikes_count = superlikes_count + 1,
    boost_score = boost_score + superlike_boost_value,
    last_boosted_at = now()
  WHERE id = target_post_id;

  -- Record transactions
  INSERT INTO transactions (user_id, type, amount, metadata)
  VALUES (sender_id, 'superlike_sent', -cost,
          jsonb_build_object('post_id', target_post_id, 'to_user', author_id));

  INSERT INTO transactions (user_id, type, amount, metadata)
  VALUES (author_id, 'superlike_received', cost,
          jsonb_build_object('post_id', target_post_id, 'from_user', sender_id));

  RETURN json_build_object('success', true, 'remaining_coins', sender_balance);
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.send_superlike(uuid) TO authenticated;
