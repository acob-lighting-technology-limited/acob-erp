-- Asset acceptance and staff problem reports.
--
-- 1. Acceptance. A person who is assigned an asset confirms they received it, or says they did not.
--    It never blocks anything: the asset is assigned straight away, and if they do nothing for three
--    working days the app counts it as accepted (`auto_accepted`). The daily job behind that is
--    /api/cron/assets/acceptance; the rule lives in lib/assets/acceptance.ts.
--
--    Existing assignments are backfilled as `not_required` ("Before acceptance"), not as accepted:
--    nobody ever confirmed them, and the record should say so. Department and office assignments
--    have no single person to confirm, so they are `not_required` too.
--
-- 2. Problem reports. Staff report a record problem from /accounts/assets ("I didn't get this",
--    "not with me", "already returned", "wrong details"); the asset admins resolve or reject it.
--    A fault goes to the existing asset_issues table instead and is not stored here.
--
-- Every write goes through server routes on the service-role client. The browser can read its own
-- reports and nothing else, and cannot change acceptance columns directly.

-- ─────────────────────────────────────────────────────────────────────────────
-- asset_assignments: acceptance columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.asset_assignments
  ADD COLUMN IF NOT EXISTS acceptance_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS acceptance_reminded_at timestamptz;

ALTER TABLE public.asset_assignments
  DROP CONSTRAINT IF EXISTS asset_assignments_acceptance_status_check;
ALTER TABLE public.asset_assignments
  ADD CONSTRAINT asset_assignments_acceptance_status_check
  CHECK (acceptance_status IN ('not_required', 'pending', 'accepted', 'auto_accepted', 'disputed'));

COMMENT ON COLUMN public.asset_assignments.acceptance_status IS
  'not_required: before acceptance existed, or a department/office assignment. pending: waiting for the '
  'person to confirm. accepted / auto_accepted: confirmed, or no response in 3 working days. disputed: '
  'the person said they did not receive it (see asset_reports).';

-- Waiting acceptances are what the daily job scans.
CREATE INDEX IF NOT EXISTS idx_asset_assignments_acceptance_pending
  ON public.asset_assignments (created_at)
  WHERE acceptance_status = 'pending' AND is_current = true;

-- New individual assignments start pending; assigning something to yourself needs no confirmation.
-- The clock runs from created_at (when the row was entered), not assigned_at, which can be backdated.
CREATE OR REPLACE FUNCTION public.set_asset_assignment_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignment_type = 'individual' AND NEW.assigned_to IS NOT NULL AND COALESCE(NEW.is_current, true) THEN
    IF NEW.assigned_by IS NOT NULL AND NEW.assigned_by = NEW.assigned_to THEN
      NEW.acceptance_status := 'accepted';
      NEW.accepted_at := now();
    ELSE
      NEW.acceptance_status := 'pending';
      NEW.accepted_at := NULL;
    END IF;
  ELSE
    NEW.acceptance_status := 'not_required';
    NEW.accepted_at := NULL;
  END IF;
  NEW.acceptance_reminded_at := NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_asset_assignment_acceptance() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_asset_assignments_set_acceptance ON public.asset_assignments;
CREATE TRIGGER trg_asset_assignments_set_acceptance
  BEFORE INSERT ON public.asset_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_asset_assignment_acceptance();

-- asset_assignments keeps a table-wide UPDATE grant and an admin-or-lead UPDATE policy, so a lead
-- could otherwise mark any assignment accepted straight through PostgREST. Only the server (service
-- role) and the database itself (cron, migrations: no JWT role) may change the acceptance columns.
CREATE OR REPLACE FUNCTION public.guard_asset_assignment_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated')
     AND (NEW.acceptance_status IS DISTINCT FROM OLD.acceptance_status
          OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
          OR NEW.acceptance_reminded_at IS DISTINCT FROM OLD.acceptance_reminded_at) THEN
    RAISE EXCEPTION 'asset acceptance can only be changed through the app';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_asset_assignment_acceptance() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_asset_assignments_guard_acceptance ON public.asset_assignments;
CREATE TRIGGER trg_asset_assignments_guard_acceptance
  BEFORE UPDATE ON public.asset_assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_asset_assignment_acceptance();

-- ─────────────────────────────────────────────────────────────────────────────
-- asset_reports: record problems raised by the person holding an asset
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.asset_assignments(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('not_received', 'not_with_me', 'already_returned', 'wrong_details')),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  -- On a resolve: whether the admin released the asset as part of it.
  released boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_reports_resolution_consistent CHECK (
    (status = 'open' AND resolved_at IS NULL) OR (status <> 'open' AND resolved_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.asset_reports IS
  'Record problems a staff member raised about an asset assigned to them. Faults go to asset_issues.';

CREATE INDEX IF NOT EXISTS idx_asset_reports_asset ON public.asset_reports (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_reports_open ON public.asset_reports (created_at) WHERE status = 'open';
-- One open report per person per asset: a second click must not open a second case.
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_reports_one_open
  ON public.asset_reports (asset_id, reported_by) WHERE status = 'open';

ALTER TABLE public.asset_reports ENABLE ROW LEVEL SECURITY;

-- The browser may read its own reports; everything else is the server's job (service role).
REVOKE ALL ON public.asset_reports FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.asset_reports FROM authenticated;
GRANT SELECT ON public.asset_reports TO authenticated;
GRANT ALL ON public.asset_reports TO service_role;

DROP POLICY IF EXISTS "Asset reports: reporter reads own" ON public.asset_reports;
CREATE POLICY "Asset reports: reporter reads own"
  ON public.asset_reports FOR SELECT TO authenticated
  USING (reported_by = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- asset_issues: do not email the holder about a fault they reported themselves
-- ─────────────────────────────────────────────────────────────────────────────
-- Staff can now report faults from /accounts/assets. The issue trigger emails the asset's holder
-- "issue reported", which is news when an admin logs it and noise when the holder just did.
-- Unchanged from the live definition except the early return on self-reports.

CREATE OR REPLACE FUNCTION public.handle_new_asset_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_assigned_to uuid;
  v_created_by_name text;
begin
  select aa.assigned_to
  into v_assigned_to
  from public.asset_assignments aa
  where aa.asset_id = new.asset_id
    and aa.is_current = true
  limit 1;

  if v_assigned_to is null or v_assigned_to = new.created_by then
    return new;
  end if;

  select coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name), p.company_email)
  into v_created_by_name
  from public.profiles p
  where p.id = new.created_by;

  perform public.enqueue_asset_notification_bundle(
    v_assigned_to,
    'asset_status_alert',
    'Asset Status Update: Issue Reported',
    'Asset issue has been reported and requires attention.',
    new.asset_id,
    v_created_by_name,
    coalesce(new.created_at, now()),
    jsonb_build_object(
      'status_action', 'Issue Reported',
      'status_description', new.description,
      'reported_by', coalesce(v_created_by_name, 'System'),
      'date', coalesce(new.created_at, now())
    ),
    'issue_new_' || new.id::text
  );

  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_asset_issue() FROM anon, authenticated, PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Daily job: remind once, then count as accepted after 3 working days.
-- Weekdays 08:20 WAT (07:20 UTC), a free slot between the 07:15 and 07:30 jobs.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'app-assets-acceptance';

SELECT cron.schedule(
  'app-assets-acceptance', '20 7 * * 1-5',
  $job$SELECT public.call_app_endpoint('/api/cron/assets/acceptance', 'GET')$job$
);
