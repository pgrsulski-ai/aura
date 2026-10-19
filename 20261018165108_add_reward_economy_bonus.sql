/*
# Reward economy: 100 coin sign-up bonus + 5 coin daily login bonus

1. Schema changes
- `profiles.wallet_balance` default raised from 0 to 100 so every new user
  created by the `handle_new_user` trigger starts with the 100 coin welcome
  bonus immediately (the trigger only inserts id + handle, relying on
  column defaults).
- New column `profiles.last_daily_bonus_at timestamptz` (nullable) tracks
  the last time the daily login bonus was claimed.
- Existing profiles whose balance is still 0 are backfilled to 100 so
  current users also receive the welcome bonus.

2. New RPC: claim_daily_bonus
- SECURITY DEFINER, scoped to the calling authenticated user via auth.uid().
- Idempotent: if `last_daily_bonus_at` is on the same calendar day (UTC),
  returns { claimed: false } and does nothing.
- Otherwise increments wallet_balance by 5, sets last_daily_bonus_at = now(),
  inserts a transactions row ("Codzienne logowanie: +5"), and returns
  { claimed: true, newBalance }.
- Returns JSON in all paths (never raises) so the frontend can branch.

3. Welcome bonus logging
- On first profile creation the welcome bonus is implicit via the column
  default. To make it visible in the transaction log, a second RPC
  `log_welcome_bonus_if_missing` is provided. It inserts a transactions row
  of type 'welcome_bonus' with amount 100 only if none exists yet for that
  user, and is called by the frontend after first sign-in.

4. Security
- Both RPCs are SECURITY DEFINER with `SET search_path = public` and only
  mutate the caller's own row (auth.uid() = id). Revoked execute from anon
  so only authenticated users can call them.
- No new tables. The existing `transactions` table is reused.
*/

-- 1. Column default + backfill
ALTER TABLE profiles ALTER COLUMN wallet_balance SET DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_daily_bonus_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_daily_bonus_at timestamptz;
  END IF;
END $$;

-- Backfill: users who never got a welcome bonus (balance still 0).
UPDATE profiles SET wallet_balance = 100 WHERE wallet_balance = 0;

-- 2. Daily bonus RPC
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_balance integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT last_daily_bonus_at, wallet_balance
    INTO v_last, v_balance
    FROM public.profiles
    WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  -- Same UTC calendar day → already claimed.
  IF v_last IS NOT NULL AND date_trunc('day', v_last) = date_trunc('day', now()) THEN
    RETURN jsonb_build_object('ok', true, 'claimed', false, 'newBalance', v_balance);
  END IF;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance + 5,
        last_daily_bonus_at = now()
    WHERE id = v_uid;

  INSERT INTO public.transactions (user_id, type, amount, metadata)
    VALUES (v_uid, 'daily_bonus', 5, jsonb_build_object('source', 'daily_login'));

  RETURN jsonb_build_object('ok', true, 'claimed', true, 'newBalance', v_balance + 5);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_bonus() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus() TO authenticated;

-- 3. Welcome bonus logging RPC
CREATE OR REPLACE FUNCTION public.log_welcome_bonus_if_missing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_uid AND type = 'welcome_bonus'
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('ok', true, 'logged', false);
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, metadata)
    VALUES (v_uid, 'welcome_bonus', 100, jsonb_build_object('source', 'signup'));

  RETURN jsonb_build_object('ok', true, 'logged', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_welcome_bonus_if_missing() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_welcome_bonus_if_missing() TO authenticated;

-- Ensure authenticated users can insert their own transaction rows
-- (the RPCs run as DEFINER so this is belt-and-suspenders for any
-- client-side logging).
DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
CREATE POLICY "transactions_insert_own"
  ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
CREATE POLICY "transactions_select_own"
  ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
