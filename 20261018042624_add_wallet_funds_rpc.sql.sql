-- SECURE DEFINER function to add purchased coins to a user's wallet.
-- Users cannot directly update wallet_balance (column lockdown); this RPC
-- is the only path to credit funds and returns the new balance.
CREATE OR REPLACE FUNCTION add_wallet_funds(row_id uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + amount
  WHERE id = row_id
  RETURNING wallet_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION add_wallet_funds(uuid, integer) TO authenticated;
