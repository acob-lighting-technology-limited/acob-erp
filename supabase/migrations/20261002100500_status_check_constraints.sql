-- CHECK constraints for the last free-text status/role columns (audit 3.7).
--
-- 34 of the 41 status/role/type text columns already carry a CHECK. These are the
-- remaining ones whose value set is closed. Every value present in live data on
-- 2026-10-02, plus every value the code writes, is allowed. notification_queue.type
-- is deliberately left open (it mirrors the extensible notification type list).

BEGIN;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_status_check
  CHECK (status IN ('available', 'assigned', 'maintenance', 'retired', 'archived'));

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_status_check
  CHECK (status IS NULL OR status IN ('success', 'error', 'partial', 'failure'));

ALTER TABLE public.broadcast_dispatches
  ADD CONSTRAINT broadcast_dispatches_status_check
  CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed'));

ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'));

ALTER TABLE public.acobot_logs
  ADD CONSTRAINT acobot_logs_role_check
  CHECK (role IS NULL OR role IN ('visitor', 'employee', 'admin', 'super_admin', 'developer'));

ALTER TABLE public.system_satisfaction_surveys
  ADD CONSTRAINT system_satisfaction_surveys_role_check
  CHECK (role IS NULL OR role IN ('visitor', 'employee', 'admin', 'super_admin', 'developer'));

COMMIT;
