-- Notification tiers (audit 2.1): the push cron now sends only action-tier
-- notifications (approvals, task reviews, overdue work), so it needs each
-- claimed row's `type`. A RETURNS TABLE change cannot be done with CREATE OR
-- REPLACE, hence drop + recreate with the same body plus `type`.
--
-- Safe in either deploy order: the app treats a missing `type` as "push", which
-- is today's behaviour.

DROP FUNCTION IF EXISTS public.claim_notifications_for_push(integer);

CREATE FUNCTION public.claim_notifications_for_push(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  category text,
  type text,
  title text,
  message text,
  link_url text,
  priority text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH claimed AS (
    SELECT n.id
    FROM public.notifications n
    WHERE n.pushed_at IS NULL
    ORDER BY n.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.notifications n
  SET pushed_at = now()
  FROM claimed c
  WHERE n.id = c.id
  RETURNING n.id, n.user_id, n.category, n.type, n.title, n.message, n.link_url, n.priority, n.created_at;
$$;

-- Only the cron route (service role) may claim.
REVOKE ALL ON FUNCTION public.claim_notifications_for_push(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_notifications_for_push(integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_notifications_for_push(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications_for_push(integer) TO service_role;
