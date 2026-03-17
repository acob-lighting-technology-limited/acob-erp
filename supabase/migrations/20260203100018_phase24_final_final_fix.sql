-- Migration: Phase 24 The Final Flush
-- Description: Clearing the very last remaining redundant policies and InitPlan warnings.

-- Table: job_postings
DROP POLICY IF EXISTS "All authenticated users can view job postings" ON job_postings;

-- Table: leave_approvals
DROP POLICY IF EXISTS "Leads and admins can create approvals" ON leave_approvals;

-- Table: interviews
DROP POLICY IF EXISTS "Interviews view policy" ON interviews;
-- "Interviews select policy" exists

-- Table: leave_requests (InitPlan on delete)
DROP POLICY IF EXISTS "Admins can delete leave requests" ON leave_requests;
CREATE POLICY "Leave requests delete policy" ON leave_requests FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: project_members
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
CREATE POLICY "Project members select policy" ON project_members FOR SELECT TO authenticated USING (true);


-- Table: attendance_records
-- Consolidate remaining redundant policies identified in advisor
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance_records;
DROP POLICY IF EXISTS "Department leads can view department attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance_records;


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
;
