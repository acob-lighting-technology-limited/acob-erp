-- Migration: 089_assign_department_lead_rpc.sql
-- Purpose: Add atomic function for assigning department leads
-- Created: 2026-02-07

CREATE OR REPLACE FUNCTION assign_department_lead(
    p_department_id UUID,
    p_new_lead_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dept_name TEXT;
BEGIN
    -- 1. Get department name
    SELECT name INTO v_dept_name FROM departments WHERE id = p_department_id;
    
    IF v_dept_name IS NULL THEN
        RAISE EXCEPTION 'Department not found';
    END IF;

    -- 2. Validate new lead exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_new_lead_id 
        AND employment_status = 'active'
    ) THEN
        RAISE EXCEPTION 'New lead profile not found or inactive';
    END IF;

    -- 3. Demote current lead(s) for this department
    UPDATE profiles
    SET is_department_lead = false
    WHERE department_id = p_department_id 
       OR id IN (SELECT department_head_id FROM departments WHERE id = p_department_id);

    -- 4. Update the department record
    UPDATE departments
    SET department_head_id = p_new_lead_id,
        updated_at = NOW()
    WHERE id = p_department_id;

    -- 5. Promote the new lead
    UPDATE profiles
    SET role = 'lead',
        department = v_dept_name,
        department_id = p_department_id,
        is_department_lead = true,
        updated_at = NOW()
    WHERE id = p_new_lead_id;

END;
$$;

GRANT EXECUTE ON FUNCTION assign_department_lead TO authenticated;
