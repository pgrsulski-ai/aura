/*
# Boost mechanic: atomic coin deduction + multiplier set

## Summary
- Adds a `boost_post(p_post_id uuid)` SECURITY DEFINER RPC that atomically
  deducts 100 coins from the caller's wallet_balance and sets the post's
  boost_multiplier to 5.0, with ownership + balance checks server-side.
- Revokes direct UPDATE on the sensitive `wallet_balance` (profiles) and
  `boost_multiplier` (posts) columns from authenticated so clients cannot
  write them directly; legitimate changes go through the RPC.

## Why
The browser is untrusted. The existing `profiles_update_own` / `posts_update_own`
policies let a user change ANY column of their own row, so `wallet_balance` and
`boost_multiplier` were effectively client-writable. Moving the mutation into a
SECURITY DEFINER function that derives the caller from auth.uid() and performs
the authorization + balance check server-side closes that gap.
*/

-- 1) Privileged, atomic boost operation -------------------------------
CREATE OR REPLACE FUNCTION boost_post(p_post_id uuid)
RETURNS TABLE (new_wallet_balance numeric, new_boost_multiplier numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner  uuid;
  v_balance numeric;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only the post's owner may boost it
  SELECT user_id INTO v_owner FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;
  IF v_owner <> v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Atomic balance check + deduction in one statement
  UPDATE profiles
    SET wallet_balance = wallet_balance - 100
    WHERE id = v_caller
      AND wallet_balance >= 100
    RETURNING wallet_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  -- Apply the multiplier
  UPDATE posts
    SET boost_multiplier = 5.0
    WHERE id = p_post_id;

  RETURN QUERY SELECT v_balance AS new_wallet_balance, 5.0 AS new_boost_multiplier;
END;
$$;

REVOKE EXECUTE ON FUNCTION boost_post(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION boost_post(uuid) TO authenticated;

-- 2) Lock down client-writable sensitive columns ---------------------
REVOKE UPDATE ON profiles FROM authenticated;
GRANT  UPDATE (handle, bio, avatar_url) ON profiles TO authenticated;

REVOKE UPDATE ON posts FROM authenticated;
GRANT  UPDATE (track_title, caption, overlay_text, overlay_filter) ON posts TO authenticated;

NOTIFY pgrst, 'reload schema';
