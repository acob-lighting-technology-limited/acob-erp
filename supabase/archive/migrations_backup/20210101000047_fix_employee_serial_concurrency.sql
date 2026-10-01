-- Ensure a monotonic, concurrency-safe serial sequence for employees
-- First, initialize the sequence with the current maximum serial found in the profiles table
DO $$
DECLARE
    max_serial INTEGER;
BEGIN
    SELECT COALESCE(MAX(
        CAST(
            NULLIF(regexp_replace(employee_number, '^.*\/([0-9]+)$', '\1'), employee_number) AS INTEGER
        )
    ), 0) INTO max_serial
    FROM profiles
    WHERE employee_number LIKE 'ACOB/%/%';

    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'employee_serial_seq') THEN
        CREATE SEQUENCE public.employee_serial_seq START WITH 1;
    END IF;
    
    PERFORM setval('public.employee_serial_seq', GREATEST(max_serial, 1), max_serial > 0);
END $$;

-- Redefine the function to use nextval() for atomicity
CREATE OR REPLACE FUNCTION get_next_employee_serial()
RETURNS TEXT AS $$
BEGIN
    -- Check if user is admin (only admins should be able to generate employee serials)
    IF NOT (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    ) THEN
        RAISE EXCEPTION 'Only administrators can generate employee serials';
    END IF;

    RETURN LPAD(nextval('public.employee_serial_seq')::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke from all and grant only to authenticated (internal check handles role)
REVOKE ALL ON FUNCTION get_next_employee_serial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_next_employee_serial() TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.employee_serial_seq TO authenticated;
