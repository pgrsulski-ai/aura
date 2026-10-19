/*
# Content Reporting & Moderation System

## Schema
- New `reports` table: reporter_id, post_id, reason, details, created_at.
  UNIQUE(reporter_id, post_id) — one report per user per post.
- New columns on posts: reports_count (int default 0), is_hidden (bool default false).

## RPC: submit_report(p_post_id, p_reason, p_details)
- Inserts a report row (enforces uniqueness via ON CONFLICT DO NOTHING).
- Increments posts.reports_count.
- If reports_count >= 3, sets is_hidden = true.
- Returns { ok, already_reported, hidden }.

## Feed exclusion
- Hidden posts (is_hidden = true) are excluded from feeds, search, and trending
  via client-side query filters added in postsApi.ts.

## RLS
- reports: authenticated can INSERT own rows, SELECT own rows only.
  No UPDATE/DELETE from client.
- posts.is_hidden and posts.reports_count are not client-writable
  (no INSERT/UPDATE policy grants cover these columns from client).
*/

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, post_id)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own"
  ON public.reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own"
  ON public.reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_post_id ON public.reports (post_id);

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reports_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.submit_report(
  p_post_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted boolean := false;
  v_new_count integer;
  v_hidden boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;

  -- Insert report; ON CONFLICT means duplicate reports are silently ignored
  INSERT INTO public.reports (reporter_id, post_id, reason, details)
    VALUES (v_uid, p_post_id, p_reason, p_details)
    ON CONFLICT (reporter_id, post_id) DO NOTHING
    RETURNING true INTO v_inserted;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('ok', true, 'already_reported', true, 'hidden', false);
  END IF;

  -- Increment reports_count and check auto-hide threshold
  UPDATE public.posts
    SET reports_count = reports_count + 1,
        is_hidden = CASE WHEN reports_count + 1 >= 3 THEN true ELSE is_hidden END
    WHERE id = p_post_id
    RETURNING reports_count, is_hidden INTO v_new_count, v_hidden;

  RETURN jsonb_build_object(
    'ok', true,
    'already_reported', false,
    'reports_count', v_new_count,
    'hidden', v_hidden
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_report(uuid, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_report(uuid, text, text) TO authenticated;
