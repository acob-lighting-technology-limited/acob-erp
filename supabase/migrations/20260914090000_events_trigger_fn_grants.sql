-- Follow-up to 20260913120000_create_events_calendar.
--
-- The two events trigger functions only ever run as triggers. Supabase's default
-- privileges still granted EXECUTE to authenticated, so the security advisor
-- listed them as callable RPCs (calling one just errors, but there is no reason
-- to expose them). Triggers fire regardless of the caller's EXECUTE privilege.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.events_guard_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_attendees_guard_self_update() FROM PUBLIC, anon, authenticated;

COMMIT;
