
-- Add updated_at column to all tables that currently lack it.
-- audit_logs is append-only (has a nonempty check constraint) — gets the column
-- but no backfill UPDATE and no trigger (rows are never updated).
-- All other tables get backfill + trigger.

DO $$
DECLARE
  tbl TEXT;
  -- Tables that are safe to UPDATE (backfill + trigger)
  normal_tables TEXT[] := ARRAY[
    'admin_logs',
    'asset_assignments',
    'consumption_data',
    'correspondence_events',
    'correspondence_versions',
    'crm_tags',
    'dev_login_logs',
    'digest_schedules',
    'employee_department_history',
    'event_notifications',
    'firmware_tasks',
    'firmware_updates',
    'help_desk_comments',
    'help_desk_events',
    'leave_approvals',
    'meter_readings',
    'notification_escalation_rules',
    'notification_queue',
    'notifications',
    'payment_categories',
    'payment_documents',
    'payslips',
    'performance_ratings',
    'project_members',
    'project_updates',
    'remote_tasks',
    'starlink_documents',
    'task_assignments',
    'task_updates',
    'task_user_completion',
    'token_records',
    'token_sales',
    'user_lead_departments',
    'user_roles'
  ];
BEGIN
  -- -----------------------------------------------------------------------
  -- 1. audit_logs: column + trigger only, no backfill UPDATE
  -- -----------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  -- -----------------------------------------------------------------------
  -- 2. All other tables: column + backfill + trigger
  -- -----------------------------------------------------------------------
  FOREACH tbl IN ARRAY normal_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
    ) THEN
      -- Add column
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
        tbl
      );

      -- Backfill from created_at where available
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'created_at'
      ) THEN
        EXECUTE format(
          'UPDATE public.%I SET updated_at = created_at',
          tbl
        );
      END IF;

      -- Attach set_updated_at trigger
      IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
      ) THEN
        EXECUTE format(
          $sql$
            CREATE TRIGGER set_%1$s_updated_at
            BEFORE UPDATE ON public.%1$I
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
          $sql$,
          tbl
        );
      END IF;

    END IF;
  END LOOP;
END;
$$;
;
