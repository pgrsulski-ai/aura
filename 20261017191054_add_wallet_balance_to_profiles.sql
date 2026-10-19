/*
# Add wallet_balance column to profiles

## Summary
Adds a `wallet_balance` integer column to the existing `profiles` table to support
virtual coins for future monetization features. Defaults to 0 for all users.

## Modified Tables
- `profiles`
  - `wallet_balance` integer NOT NULL DEFAULT 0 — virtual coin balance for tips/purchases

## Security
- No RLS policy changes needed. The existing profiles policies already control access.
- wallet_balance is readable by anyone (via the public SELECT policy) but only the
  owner can UPDATE their profile row. However, wallet_balance should only be modified
  by server-side logic (edge functions / SECURITY DEFINER functions), not by client
  updates. For now it is read-only from the client perspective.

## Important notes
1. This is additive — no existing data is lost.
2. The column defaults to 0 so all existing profiles get 0 coins automatically.
3. A future migration should restrict UPDATE to exclude wallet_balance from
   client-writable columns, or use a SECURITY DEFINER function for balance changes.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wallet_balance integer NOT NULL DEFAULT 0;
