-- Unindexed Foreign Keys
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_id ON public.weekly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON public.system_settings(updated_by);

-- Duplicate Index
DROP INDEX IF EXISTS public.idx_audit_logs_user_id_fk;
;
