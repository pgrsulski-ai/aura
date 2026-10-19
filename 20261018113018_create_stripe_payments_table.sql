-- Tracks Stripe Checkout Sessions that have already credited coins,
-- so a replayed webhook (or duplicate delivery) never double-credits.
CREATE TABLE IF NOT EXISTS stripe_payments (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  coins integer NOT NULL,
  credited_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

-- No client access: only the webhook edge function (service role) writes here.
CREATE POLICY "none_select_stripe_payments" ON stripe_payments
  FOR SELECT TO authenticated USING (false);
CREATE POLICY "none_insert_stripe_payments" ON stripe_payments
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "none_update_stripe_payments" ON stripe_payments
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "none_delete_stripe_payments" ON stripe_payments
  FOR DELETE TO authenticated USING (false);
