-- Web push delivery by polling.
--
-- A scheduled run claims unsent notifications and pushes them, rather than a
-- trigger firing one HTTP call per inserted row. This survives an app restart
-- (an unclaimed row is simply still unclaimed next run, whereas a per-row
-- net.http_post would have dropped it silently) and collapses a 51-row
-- broadcast into one invocation instead of 51 concurrent ones.
-- Scheduling lives in pg_cron -- see section 5 for why.

-- ---------------------------------------------------------------------------
-- 1. Model the notification categories that actually exist
-- ---------------------------------------------------------------------------
-- notifications.category already contains 'approvals' (342 rows) and 'tasks'
-- (256 rows), but the policy table's CHECK never allowed them, so those
-- categories had no delivery policy of their own.

ALTER TABLE public.notification_delivery_policies
  DROP CONSTRAINT IF EXISTS notification_delivery_policies_key_check;

ALTER TABLE public.notification_delivery_policies
  ADD CONSTRAINT notification_delivery_policies_key_check
  CHECK (notification_key = ANY (ARRAY[
    'onboarding', 'help_desk', 'leave', 'assets', 'meetings',
    'communications', 'reports', 'system', 'approvals', 'tasks'
  ]));

INSERT INTO public.notification_delivery_policies (notification_key)
VALUES ('approvals'), ('tasks')
ON CONFLICT (notification_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Push stays opt-out, even for system alerts
-- ---------------------------------------------------------------------------
-- 'system' is a third of all notifications. Mandatory push there would stop a
-- user muting the loudest category on their own phone. Nothing is lost: in_app
-- and email remain mandatory for 'system'.

UPDATE public.notification_delivery_policies
SET push_mandatory = false
WHERE notification_key = 'system';

-- ---------------------------------------------------------------------------
-- 3. Delivery state
-- ---------------------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- Backfill every existing row as already handled. Without this the first cron
-- run would treat the entire history (~4,600 rows) as a pending push and
-- notify everyone about months-old events.
UPDATE public.notifications
SET pushed_at = created_at
WHERE pushed_at IS NULL;

-- Partial index: the query only ever looks for unsent rows, and this keeps the
-- index tiny (it holds the backlog, not the archive).
CREATE INDEX IF NOT EXISTS notifications_pending_push_idx
  ON public.notifications (created_at)
  WHERE pushed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Atomic claim
-- ---------------------------------------------------------------------------
-- Marks rows as claimed and returns them in one statement. FOR UPDATE SKIP
-- LOCKED means two overlapping cron runs can never claim the same row, so a
-- slow run cannot cause a duplicate notification on someone's phone.

CREATE OR REPLACE FUNCTION public.claim_notifications_for_push(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  category text,
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
  RETURNING n.id, n.user_id, n.category, n.title, n.message, n.link_url, n.priority, n.created_at;
$$;

-- Only the cron route (service role) may claim. Leaving this executable by
-- authenticated users would let anyone mark notifications as pushed.
REVOKE ALL ON FUNCTION public.claim_notifications_for_push(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_notifications_for_push(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications_for_push(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Scheduling
-- ---------------------------------------------------------------------------
-- The schedule lives in pg_cron, not Vercel Cron: the Vercel Hobby plan allows
-- only 2 cron jobs at daily granularity, while pg_cron here already runs
-- minute-level jobs (process-notifications-every-minute). This is still
-- polling — Postgres asks the app to drain the queue, it does not hand over
-- notification data — so the claim/retry behaviour above is unchanged.
--
-- Credentials come from Vault. push_cron_secret is the SAME value as the app's
-- existing CRON_SECRET, so no new credential is introduced.

CREATE OR REPLACE FUNCTION public.call_app_endpoint(p_path text, p_method text DEFAULT 'GET')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'net', 'pg_temp'
AS $$
DECLARE
  v_base text;
  v_secret text;
  v_headers jsonb;
BEGIN
  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets WHERE name = 'app_base_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'app_cron_secret';

  -- No-op until configured, so this can ship ahead of the deploy.
  IF v_base IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;

  v_headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret);

  IF upper(p_method) = 'POST' THEN
    PERFORM net.http_post(
      url := rtrim(v_base, '/') || p_path,
      headers := v_headers || jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb
    );
  ELSE
    PERFORM net.http_get(url := rtrim(v_base, '/') || p_path, headers := v_headers);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.call_app_endpoint(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.call_app_endpoint(text, text) FROM authenticated;

SELECT cron.unschedule('process-push-every-minute')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-push-every-minute');

SELECT cron.schedule(
  'process-push-every-minute', '* * * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/push', 'GET')$job$
);
