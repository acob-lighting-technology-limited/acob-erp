-- Fix View Security for all public views
-- Make the views use invoker's permissions (Security Invoker) instead of owner's
-- This ensures RLS policies on underlying tables are respected for the querying user
ALTER VIEW office_locations_by_type SET (security_invoker = true);
ALTER VIEW view_dashboard_stats SET (security_invoker = true);
ALTER VIEW office_location_usage SET (security_invoker = true);
ALTER VIEW v_customer_token_stats SET (security_invoker = true);
ALTER VIEW v_active_tasks_summary SET (security_invoker = true);
ALTER VIEW v_latest_meter_readings SET (security_invoker = true);

-- Fix potential RLS issue on customers table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers') THEN
        ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
