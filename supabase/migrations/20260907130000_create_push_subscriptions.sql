-- Web Push support.
--
-- Adds the device subscription store, plus a `push` column everywhere the
-- existing in_app/email channels are already modelled, so push flows through
-- resolveChannelEligibleUserIds on the same rules rather than bypassing the
-- preference system.

-- ---------------------------------------------------------------------------
-- 1. Device subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The push service URL for one browser install. Globally unique, and the
  -- natural conflict target when a device re-subscribes.
  endpoint text NOT NULL UNIQUE,
  -- Encryption material from the browser's PushSubscription.
  p256dh text NOT NULL,
  auth text NOT NULL,
  -- Helps a user tell their own devices apart when revoking one.
  user_agent text,
  -- Consecutive delivery failures. A 404/410 from the push service means the
  -- subscription is permanently gone and the row should be deleted outright;
  -- this counter is for transient failures.
  failure_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user may only ever see or touch their own devices. Sending happens with
-- the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Push subscriptions select own" ON public.push_subscriptions;
CREATE POLICY "Push subscriptions select own" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Push subscriptions insert own" ON public.push_subscriptions;
CREATE POLICY "Push subscriptions insert own" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Push subscriptions update own" ON public.push_subscriptions;
CREATE POLICY "Push subscriptions update own" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Push subscriptions delete own" ON public.push_subscriptions;
CREATE POLICY "Push subscriptions delete own" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Push as a first-class channel in the preference tables
-- ---------------------------------------------------------------------------

-- System-wide, per module. Defaults to enabled to match in_app/email, but
-- nothing is delivered until a user actually grants permission on a device.
ALTER TABLE public.notification_delivery_policies
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_mandatory boolean NOT NULL DEFAULT false;

-- Per user, global.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

-- Per user, per module. Nullable: NULL means "no preference", which the
-- delivery gate reads as allowed.
ALTER TABLE public.notification_user_delivery_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean;

-- `system` is mandatory on the other channels; keep push consistent with that.
UPDATE public.notification_delivery_policies
SET push_mandatory = true
WHERE notification_key = 'system';
