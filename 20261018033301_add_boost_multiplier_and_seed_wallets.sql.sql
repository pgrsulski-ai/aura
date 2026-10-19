/*
# Add boost_multiplier column and seed test wallet balance

## Summary
- Adds a `boost_multiplier` numeric column to posts (default 1.0) for future
  boosted-reach / promoted content functionality.
- Sets all profiles' wallet_balance to 1000 for testing purposes.

## Changes
- ALTER TABLE posts ADD COLUMN boost_multiplier numeric DEFAULT 1.0
- UPDATE profiles SET wallet_balance = 1000
*/

ALTER TABLE posts ADD COLUMN IF NOT EXISTS boost_multiplier numeric DEFAULT 1.0;

UPDATE profiles SET wallet_balance = 1000;

NOTIFY pgrst, 'reload schema';
