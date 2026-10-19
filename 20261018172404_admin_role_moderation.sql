/*
# Admin Role & Moderation Capabilities

## Schema
- profiles.role text NOT NULL DEFAULT 'user' (values: 'user' | 'admin').

## Column lockdown (secure-data-access pattern)
- REVOKE UPDATE on profiles.role so users can't self-promote via the data API.
  The existing profiles_update_own policy allows updating any column on the
  user's own row; the column-level REVOKE blocks the role column specifically.

## RLS — admin override policies
- posts: admin can DELETE any row, UPDATE is_hidden on any row.
- comments: admin can DELETE any row.
- reports: admin can SELECT all rows.
  All use a shared predicate: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin').

## RPCs (SECURITY DEFINER, search_path pinned, auth.uid()-scoped)
1. admin_delete_post(p_post_id) — deletes any post (regardless of owner).
2. admin_delete_comment(p_comment_id) — deletes any comment.
3. admin_restore_post(p_post_id) — resets reports_count=0, is_hidden=false.
4. fetch_reported_posts() — returns all posts with reports_count > 0 OR is_hidden = true,
   joined with report reasons. (Admin-only.)
*/

-- ── 1. Add role column to profiles ───────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Lock down the role column: users cannot self-promote via the data API.
-- The existing profiles_update_own policy allows updating own row; this
-- column-level REVOKE blocks the role column specifically.
REVOKE UPDATE (role) ON public.profiles FROM authenticated;

-- ── 2. Admin RLS policies on posts ───────────────────────
-- Admin can delete any post
DROP POLICY IF EXISTS "posts_delete_admin" ON public.posts;
CREATE POLICY "posts_delete_admin"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update any post (needed to toggle is_hidden)
DROP POLICY IF EXISTS "posts_update_admin" ON public.posts;
CREATE POLICY "posts_update_admin"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 3. Admin RLS policies on comments ────────────────────
-- Admin can delete any comment
DROP POLICY IF EXISTS "comments_delete_admin" ON public.comments;
CREATE POLICY "comments_delete_admin"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 4. Admin RLS policies on reports ─────────────────────
-- Admin can read all reports
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 5. Admin RPCs ────────────────────────────────────────

-- Delete any post as admin
CREATE OR REPLACE FUNCTION public.admin_delete_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT role = 'admin' INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_post(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_post(uuid) TO authenticated;

-- Delete any comment as admin
CREATE OR REPLACE FUNCTION public.admin_delete_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT role = 'admin' INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM public.comments WHERE id = p_comment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'comment_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_comment(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_comment(uuid) TO authenticated;

-- Restore a post: reset reports_count and is_hidden
CREATE OR REPLACE FUNCTION public.admin_restore_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT role = 'admin' INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE public.posts
    SET reports_count = 0, is_hidden = false
    WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_restore_post(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_post(uuid) TO authenticated;

-- Fetch all reported/hidden posts with report reasons (admin only)
CREATE OR REPLACE FUNCTION public.fetch_reported_posts()
RETURNS TABLE (
  post_id uuid,
  track_title text,
  caption text,
  user_id uuid,
  handle text,
  media_url text,
  reports_count integer,
  is_hidden boolean,
  report_reasons text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT role = 'admin' INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
    SELECT
      p.id AS post_id,
      p.track_title,
      p.caption,
      p.user_id,
      pr.handle,
      p.media_url,
      p.reports_count,
      p.is_hidden,
      COALESCE(
        ARRAY_AGG(DISTINCT r.reason) FILTER (WHERE r.reason IS NOT NULL),
        ARRAY[]::text[]
      ) AS report_reasons
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    LEFT JOIN public.reports r ON r.post_id = p.id
    WHERE p.reports_count > 0 OR p.is_hidden = true
    GROUP BY p.id, pr.handle
    ORDER BY p.reports_count DESC, p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fetch_reported_posts() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_reported_posts() TO authenticated;
