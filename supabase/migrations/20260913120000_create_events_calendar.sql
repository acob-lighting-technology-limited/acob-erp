-- Company events calendar + MD's Desk.
--
-- One events table for every kind of engagement (meeting, workshop, webinar,
-- activity, training, holiday) instead of a module per type. Staff see events
-- on /calendar; Corporate Services and department leads manage them from
-- /admin/events; MD's Desk (/admin/md-desk) is a filtered executive view.
--
-- Who may do what:
--   * Create events      -> admins, Corporate Services staff, department leads.
--                           A department lead may only attach their own
--                           department(s).
--   * Private events     -> MD's Desk editors only (the MD + delegates with
--                           can_edit). Details are visible to the MD, all
--                           delegates, the organizer and invitees. Everyone
--                           else gets a "Busy" block via get_md_busy_blocks(),
--                           which returns times only. Admins are deliberately
--                           NOT granted private details.
--   * RSVP               -> an invitee may change only rsvp / responded_at on
--                           their own attendee row (enforced by trigger).
--
-- Rooms: room_id points at office_locations; an exclusion constraint stops two
-- scheduled events overlapping in the same room.
--
-- Recurrence and reminders are Phase 3 and intentionally absent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL
    CHECK (type IN ('meeting', 'workshop', 'webinar', 'activity', 'training', 'holiday')),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location_type text NOT NULL DEFAULT 'physical'
    CHECK (location_type IN ('physical', 'virtual', 'hybrid')),
  room_id uuid REFERENCES public.office_locations(id) ON DELETE SET NULL,
  -- Free text for venues that are not a company room (a hotel, a client site).
  venue text,
  meeting_url text,
  visibility text NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company', 'department', 'invitees', 'private')),
  -- Owning department. Required when visibility = 'department'.
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  md_involvement text NOT NULL DEFAULT 'none'
    CHECK (md_involvement IN ('host', 'attending', 'none')),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('draft', 'scheduled', 'cancelled', 'completed')),
  organizer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT events_time_order CHECK (end_at > start_at),
  CONSTRAINT events_department_visibility
    CHECK (visibility <> 'department' OR department_id IS NOT NULL),
  CONSTRAINT events_private_is_md
    CHECK (visibility <> 'private' OR md_involvement <> 'none'),
  CONSTRAINT events_virtual_has_url
    CHECK (location_type = 'physical' OR meeting_url IS NOT NULL),
  -- No double-booked rooms. Drafts and cancelled events do not hold the room.
  CONSTRAINT events_no_room_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (room_id IS NOT NULL AND status IN ('scheduled', 'completed'))
);

CREATE INDEX IF NOT EXISTS events_start_at_idx ON public.events (start_at);
CREATE INDEX IF NOT EXISTS events_department_id_idx ON public.events (department_id);
CREATE INDEX IF NOT EXISTS events_md_involvement_idx
  ON public.events (start_at) WHERE md_involvement <> 'none';

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Set when the person was added by inviting a whole department. Display
  -- only; the app expands a department invite into one row per member.
  invited_via_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  rsvp text NOT NULL DEFAULT 'pending'
    CHECK (rsvp IN ('pending', 'yes', 'no', 'maybe')),
  responded_at timestamptz,
  attended boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS event_attendees_profile_id_idx
  ON public.event_attendees (profile_id);

DROP TRIGGER IF EXISTS event_attendees_set_updated_at ON public.event_attendees;
CREATE TRIGGER event_attendees_set_updated_at
  BEFORE UPDATE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.md_desk_delegates (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_edit boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS md_desk_delegates_set_updated_at ON public.md_desk_delegates;
CREATE TRIGGER md_desk_delegates_set_updated_at
  BEFORE UPDATE ON public.md_desk_delegates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Access helpers
--
-- SECURITY DEFINER so policies on events and event_attendees can consult each
-- other without recursing through RLS.
-- ---------------------------------------------------------------------------

-- The MD is the head of the Executive Management department (code MD).
-- departments.department_head_id is kept in sync by enforce_single_department_lead().
CREATE OR REPLACE FUNCTION public.is_md()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.department_code = 'MD'
      AND d.department_head_id = (SELECT auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_md_desk_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_md()
      OR EXISTS (SELECT 1 FROM public.md_desk_delegates WHERE profile_id = (SELECT auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.can_edit_md_desk()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_md()
      OR EXISTS (
        SELECT 1 FROM public.md_desk_delegates
        WHERE profile_id = (SELECT auth.uid()) AND can_edit
      )
$$;

CREATE OR REPLACE FUNCTION public.is_corporate_services_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.departments d ON d.department_code = 'CS'
    WHERE p.id = (SELECT auth.uid())
      AND (p.department_id = d.id OR d.id = ANY (COALESCE(p.lead_department_ids, ARRAY[]::uuid[])))
  )
$$;

-- Company-wide event managers: admins and Corporate Services.
CREATE OR REPLACE FUNCTION public.is_event_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin_like() OR public.is_corporate_services_member()
$$;

CREATE OR REPLACE FUNCTION public.leads_department(p_department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_department_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND is_department_lead IS TRUE
      AND p_department_id = ANY (COALESCE(lead_department_ids, ARRAY[]::uuid[]))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_create_events()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_event_manager()
      OR public.can_edit_md_desk()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND is_department_lead IS TRUE
      )
$$;

-- Full-detail read access to one event.
CREATE OR REPLACE FUNCTION public.can_view_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND (
        e.created_by = (SELECT auth.uid())
        OR e.organizer_id = (SELECT auth.uid())
        -- Invitees see the event once it is out of draft, even when private.
        OR (
          e.status <> 'draft'
          AND EXISTS (
            SELECT 1 FROM public.event_attendees a
            WHERE a.event_id = e.id AND a.profile_id = (SELECT auth.uid())
          )
        )
        OR (e.md_involvement <> 'none' AND public.is_md_desk_member())
        OR (
          e.visibility <> 'private'
          AND (
            public.is_event_manager()
            OR public.leads_department(e.department_id)
            OR (
              e.status <> 'draft'
              AND (
                (e.visibility = 'company' AND public.has_role('employee'))
                OR (
                  e.visibility = 'department'
                  AND EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = (SELECT auth.uid()) AND p.department_id = e.department_id
                  )
                )
              )
            )
          )
        )
      )
  )
$$;

-- Edit access to one event (update, delete, manage attendees).
CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND (
        (e.md_involvement <> 'none' AND public.can_edit_md_desk())
        OR (
          e.visibility <> 'private'
          AND (
            public.is_event_manager()
            OR e.created_by = (SELECT auth.uid())
            OR e.organizer_id = (SELECT auth.uid())
            OR public.leads_department(e.department_id)
          )
        )
      )
  )
$$;

-- Batch form of can_manage_event for list screens, so the API resolves edit
-- rights for a month of events in one round trip instead of one call each.
CREATE OR REPLACE FUNCTION public.manageable_event_ids(p_event_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id FROM unnest(p_event_ids) AS id WHERE public.can_manage_event(id)
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.manageable_event_ids(uuid[])',
    'public.is_md()',
    'public.is_md_desk_member()',
    'public.can_edit_md_desk()',
    'public.is_corporate_services_member()',
    'public.is_event_manager()',
    'public.leads_department(uuid)',
    'public.can_create_events()',
    'public.can_view_event(uuid)',
    'public.can_manage_event(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS: events
-- ---------------------------------------------------------------------------

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.events FROM anon;

-- The inline creator/organizer checks come first on purpose: during
-- INSERT ... RETURNING the helper's snapshot cannot see the row being inserted.
DROP POLICY IF EXISTS "Events select visible" ON public.events;
CREATE POLICY "Events select visible" ON public.events
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR organizer_id = (SELECT auth.uid())
    OR public.can_view_event(id)
  );

DROP POLICY IF EXISTS "Events insert by creators" ON public.events;
CREATE POLICY "Events insert by creators" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND public.can_create_events());

DROP POLICY IF EXISTS "Events update by managers" ON public.events;
CREATE POLICY "Events update by managers" ON public.events
  FOR UPDATE TO authenticated
  USING (public.can_manage_event(id));

DROP POLICY IF EXISTS "Events delete by managers" ON public.events;
CREATE POLICY "Events delete by managers" ON public.events
  FOR DELETE TO authenticated
  USING (public.can_manage_event(id));

-- Field-level rules that depend on what changed, which a policy cannot see.
-- Checked only when the guarded field is set on insert or changed on update,
-- so a department lead can still retitle their event after Corporate Services
-- has marked the MD as attending.
CREATE OR REPLACE FUNCTION public.events_guard_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- created_by is the audit anchor; it never changes after insert.
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;

  -- Service role (cron, server jobs) has no auth.uid() and is unrestricted.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only MD's Desk editors create private events or make an event private.
  IF NEW.visibility = 'private'
     AND (TG_OP = 'INSERT' OR OLD.visibility IS DISTINCT FROM 'private')
     AND NOT public.can_edit_md_desk() THEN
    RAISE EXCEPTION 'Only MD''s Desk editors can create private events'
      USING ERRCODE = '42501';
  END IF;

  -- Putting an event on (or off) the MD's schedule needs MD's Desk or a
  -- company event manager.
  IF (TG_OP = 'INSERT' AND NEW.md_involvement <> 'none'
      OR TG_OP = 'UPDATE' AND NEW.md_involvement IS DISTINCT FROM OLD.md_involvement)
     AND NOT (public.can_edit_md_desk() OR public.is_event_manager()) THEN
    RAISE EXCEPTION 'Only MD''s Desk or Corporate Services can change MD involvement'
      USING ERRCODE = '42501';
  END IF;

  -- A department lead may only attach departments they lead.
  IF NEW.department_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.department_id IS DISTINCT FROM OLD.department_id)
     AND NOT (public.is_event_manager()
              OR public.can_edit_md_desk()
              OR public.leads_department(NEW.department_id)) THEN
    RAISE EXCEPTION 'You can only create events for departments you lead'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.events_guard_write() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS events_guard_write ON public.events;
CREATE TRIGGER events_guard_write
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_guard_write();

-- ---------------------------------------------------------------------------
-- 4. RLS: event_attendees
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_attendees FROM anon;

DROP POLICY IF EXISTS "Event attendees select visible" ON public.event_attendees;
CREATE POLICY "Event attendees select visible" ON public.event_attendees
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()) OR public.can_view_event(event_id));

DROP POLICY IF EXISTS "Event attendees insert by managers" ON public.event_attendees;
CREATE POLICY "Event attendees insert by managers" ON public.event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_event(event_id));

-- Managers edit any row; an invitee edits their own (narrowed by trigger below).
DROP POLICY IF EXISTS "Event attendees update" ON public.event_attendees;
CREATE POLICY "Event attendees update" ON public.event_attendees
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()) OR public.can_manage_event(event_id))
  WITH CHECK (profile_id = (SELECT auth.uid()) OR public.can_manage_event(event_id));

DROP POLICY IF EXISTS "Event attendees delete by managers" ON public.event_attendees;
CREATE POLICY "Event attendees delete by managers" ON public.event_attendees
  FOR DELETE TO authenticated
  USING (public.can_manage_event(event_id));

-- An invitee who is not a manager may only answer the invitation.
CREATE OR REPLACE FUNCTION public.event_attendees_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role (cron, server jobs) has no auth.uid() and is unrestricted.
  IF (SELECT auth.uid()) IS NULL OR public.can_manage_event(OLD.event_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.invited_via_department_id IS DISTINCT FROM OLD.invited_via_department_id
     OR NEW.attended IS DISTINCT FROM OLD.attended THEN
    RAISE EXCEPTION 'Invitees may only change their RSVP'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.rsvp IS DISTINCT FROM OLD.rsvp THEN
    NEW.responded_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.event_attendees_guard_self_update() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS event_attendees_guard_self_update ON public.event_attendees;
CREATE TRIGGER event_attendees_guard_self_update
  BEFORE UPDATE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.event_attendees_guard_self_update();

-- ---------------------------------------------------------------------------
-- 5. RLS: md_desk_delegates
--
-- The MD controls the list. Admins can also manage it so the desk can be set
-- up before the MD first signs in.
-- ---------------------------------------------------------------------------

ALTER TABLE public.md_desk_delegates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.md_desk_delegates FROM anon;

DROP POLICY IF EXISTS "MD desk delegates select" ON public.md_desk_delegates;
CREATE POLICY "MD desk delegates select" ON public.md_desk_delegates
  FOR SELECT TO authenticated
  USING (public.is_md_desk_member() OR public.is_admin_like());

DROP POLICY IF EXISTS "MD desk delegates insert" ON public.md_desk_delegates;
CREATE POLICY "MD desk delegates insert" ON public.md_desk_delegates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.is_admin_like());

DROP POLICY IF EXISTS "MD desk delegates update" ON public.md_desk_delegates;
CREATE POLICY "MD desk delegates update" ON public.md_desk_delegates
  FOR UPDATE TO authenticated
  USING (public.is_md() OR public.is_admin_like())
  WITH CHECK (public.is_md() OR public.is_admin_like());

DROP POLICY IF EXISTS "MD desk delegates delete" ON public.md_desk_delegates;
CREATE POLICY "MD desk delegates delete" ON public.md_desk_delegates
  FOR DELETE TO authenticated
  USING (public.is_md() OR public.is_admin_like());

-- ---------------------------------------------------------------------------
-- 6. Busy blocks
--
-- Times only, no title/venue/attendees, for private MD events the caller
-- cannot see in full. Capped at a 93-day window.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_md_busy_blocks(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (start_at timestamptz, end_at timestamptz, all_day boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('employee') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF p_to <= p_from OR p_to - p_from > interval '93 days' THEN
    RAISE EXCEPTION 'Window must be positive and at most 93 days' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT e.start_at, e.end_at, e.all_day
  FROM public.events e
  WHERE e.visibility = 'private'
    AND e.status IN ('scheduled', 'completed')
    AND e.start_at < p_to
    AND e.end_at > p_from
    AND NOT public.can_view_event(e.id)
  ORDER BY e.start_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_md_busy_blocks(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_md_busy_blocks(timestamptz, timestamptz) TO authenticated;

COMMIT;
