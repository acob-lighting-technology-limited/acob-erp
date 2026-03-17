-- Migration: Phase 23 The Absolute Performance Finality
-- Description: Clears the absolute last remaining redundant policies and InitPlan warnings.

-- =====================================================
-- 1. CONSOLIDATE RECRUITMENT MODULE (Redundancy & InitPlan)
-- =====================================================

-- Table: job_postings
DROP POLICY IF EXISTS "Admins can manage recruitment" ON job_postings;
DROP POLICY IF EXISTS "Only admins can manage job postings" ON job_postings;
DROP POLICY IF EXISTS "Job postings select policy" ON job_postings;
DROP POLICY IF EXISTS "Job postings insert policy" ON job_postings;
DROP POLICY IF EXISTS "Job postings update policy" ON job_postings;
DROP POLICY IF EXISTS "Job postings delete policy" ON job_postings;

CREATE POLICY "Job postings select policy" ON job_postings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Job postings insert policy" ON job_postings FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Job postings update policy" ON job_postings FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Job postings delete policy" ON job_postings FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: interviews
DROP POLICY IF EXISTS "Recruitment staff view interviews" ON interviews;
DROP POLICY IF EXISTS "Interviews select policy" ON interviews;
CREATE POLICY "Interviews select policy" ON interviews 
FOR SELECT TO authenticated 
USING ((SELECT has_role('admin')) OR interviewer_id = (SELECT auth.uid()));


-- =====================================================
-- 2. CONSOLIDATE LEAVE MODULE FINAL (Redundancy & InitPlan)
-- =====================================================

-- Table: leave_balances
DROP POLICY IF EXISTS "Only admins can manage leave balances" ON leave_balances;
DROP POLICY IF EXISTS "Users can view own leave balances" ON leave_balances;
DROP POLICY IF EXISTS "Admins can view all leave balances" ON leave_balances;
DROP POLICY IF EXISTS "Department leads can view department balances" ON leave_balances;
DROP POLICY IF EXISTS "Leave balances manage policy" ON leave_balances;
DROP POLICY IF EXISTS "Leave balances insert policy" ON leave_balances;
DROP POLICY IF EXISTS "Leave balances update policy" ON leave_balances;
DROP POLICY IF EXISTS "Leave balances delete policy" ON leave_balances;

CREATE POLICY "Leave balances insert policy" ON leave_balances FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Leave balances update policy" ON leave_balances FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Leave balances delete policy" ON leave_balances FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: leave_requests (Remaining InitPlan on INSERT)
DROP POLICY IF EXISTS "Users can create own leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Leave requests insert policy" ON leave_requests;
CREATE POLICY "Leave requests insert policy" ON leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- Table: leave_approvals
DROP POLICY IF EXISTS "Only admins can manage leave approvals" ON leave_approvals;
DROP POLICY IF EXISTS "Leave approvals manage policy" ON leave_approvals;
DROP POLICY IF EXISTS "Leave approvals insert policy" ON leave_approvals;
DROP POLICY IF EXISTS "Leave approvals update policy" ON leave_approvals;
DROP POLICY IF EXISTS "Leave approvals delete policy" ON leave_approvals;

CREATE POLICY "Leave approvals insert policy" ON leave_approvals FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Leave approvals update policy" ON leave_approvals FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Leave approvals delete policy" ON leave_approvals FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. PROFILE MODULE FINAL (Redundancy)
-- =====================================================

-- Table: profiles
DROP POLICY IF EXISTS "Profiles view policy" ON profiles;
-- "Profiles select policy" exists from Phase 22


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
;
