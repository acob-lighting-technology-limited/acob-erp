-- Migration: Phase 30 CodeRabbit Security & Logic Fixes (V2)
-- Description: Applying critical fixes identified by CodeRabbit audit.
-- Correcting syntax for multiple commands in a single policy.

-- =====================================================
-- 1. USER ROLES (Split Select from Write)
-- =====================================================
DROP POLICY IF EXISTS "User roles manage policy" ON user_roles;
DROP POLICY IF EXISTS "User roles select policy" ON user_roles;
DROP POLICY IF EXISTS "User roles select (self or admin)" ON user_roles;
DROP POLICY IF EXISTS "User roles admin write" ON user_roles;
DROP POLICY IF EXISTS "User roles insert policy" ON user_roles;
DROP POLICY IF EXISTS "User roles update policy" ON user_roles;
DROP POLICY IF EXISTS "User roles delete policy" ON user_roles;

CREATE POLICY "User roles select (self or admin)" ON user_roles 
FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()) OR (SELECT has_role('admin')) OR (SELECT has_role('super_admin')));

CREATE POLICY "User roles insert policy" ON user_roles FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));
CREATE POLICY "User roles update policy" ON user_roles FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));
CREATE POLICY "User roles delete policy" ON user_roles FOR DELETE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));


-- =====================================================
-- 2. DEPARTMENT PAYMENTS (Type Mismatch Fix)
-- =====================================================
DROP POLICY IF EXISTS "Department payments select policy" ON department_payments;
CREATE POLICY "Department payments select policy" ON department_payments 
FOR SELECT TO authenticated 
USING (
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles p1
        WHERE p1.id = (SELECT auth.uid()) 
        AND p1.department_id = department_payments.department_id -- UUID vs UUID
    ))
);


-- =====================================================
-- 3. TIMESHEETS (Restore Write Policy)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Timesheets insert policy" ON timesheets;
DROP POLICY IF EXISTS "Timesheets update policy" ON timesheets;
DROP POLICY IF EXISTS "Timesheets delete policy" ON timesheets;

CREATE POLICY "Timesheets insert policy" ON timesheets FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Timesheets update policy" ON timesheets FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Timesheets delete policy" ON timesheets FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));


-- =====================================================
-- 4. PAYMENT DOCUMENTS (Split ALL to UPDATE/DELETE)
-- =====================================================
DROP POLICY IF EXISTS "Payment documents manage policy" ON public.payment_documents;
DROP POLICY IF EXISTS "Payment documents update policy" ON public.payment_documents;
DROP POLICY IF EXISTS "Payment documents delete policy" ON public.payment_documents;

CREATE POLICY "Payment documents update policy" ON public.payment_documents 
FOR UPDATE TO authenticated 
USING ((SELECT has_role('admin')) OR uploaded_by = (SELECT auth.uid()))
WITH CHECK ((SELECT has_role('admin')) OR uploaded_by = (SELECT auth.uid()));

CREATE POLICY "Payment documents delete policy" ON public.payment_documents 
FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')) OR uploaded_by = (SELECT auth.uid()));


-- =====================================================
-- 5. LEAVE APPROVALS (Restore Requester Visibility)
-- =====================================================
DROP POLICY IF EXISTS "Leave approvals select policy" ON leave_approvals;
CREATE POLICY "Leave approvals select policy" ON leave_approvals 
FOR SELECT TO authenticated 
USING (
    approver_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = leave_approvals.approver_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    )) OR
    EXISTS (
        SELECT 1 FROM leave_requests
        WHERE id = leave_approvals.leave_request_id
        AND user_id = (SELECT auth.uid())
    )
);


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
