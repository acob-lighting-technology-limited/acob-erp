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
        
        -- Create initial policies if they don't exist to prevent blocking access
        -- SELECT: Authenticated users can view customers
        DROP POLICY IF EXISTS "Customers select policy" ON customers;
        CREATE POLICY "Customers select policy" ON customers FOR SELECT TO authenticated USING (true);
        
        -- INSERT: Admins and Staff can create customers
        DROP POLICY IF EXISTS "Customers insert policy" ON customers;
        CREATE POLICY "Customers insert policy" ON customers FOR INSERT TO authenticated WITH CHECK (has_role('admin') OR has_role('staff'));
        
        -- UPDATE: Admins and Staff can update customers
        DROP POLICY IF EXISTS "Customers update policy" ON customers;
        CREATE POLICY "Customers update policy" ON customers FOR UPDATE TO authenticated USING (has_role('admin') OR has_role('staff'));
        
        -- DELETE: Only Admins can delete customers
        DROP POLICY IF EXISTS "Customers delete policy" ON customers;
        CREATE POLICY "Customers delete policy" ON customers FOR DELETE TO authenticated USING (has_role('admin'));
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
