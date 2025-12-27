-- Migration to restrict non-admin users to only manage their own payments
-- Users can still VIEW all payments in their department, but can only EDIT/DELETE their own.

-- 1. Update DELETE Policy
-- First, drop the old restrictive "Only admins can delete" policy
DROP POLICY IF EXISTS "Only admins can delete payments" ON department_payments;
-- Drop any potential previous version of the user delete policy to be safe
DROP POLICY IF EXISTS "Users can delete their own payments" ON department_payments;

CREATE POLICY "Users can delete their own payments"
    ON department_payments FOR DELETE
    USING (
        -- Allow if user is the creator
        created_by = auth.uid() 
        OR
        -- OR if user is an admin
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- 2. Update UPDATE Policy
-- Drop the broad "Users can update their department payments" policy
DROP POLICY IF EXISTS "Users can update their department payments" ON department_payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON department_payments;

CREATE POLICY "Users can update their own payments"
    ON department_payments FOR UPDATE
    USING (
        -- Allow if user is the creator
        created_by = auth.uid()
        -- Note: Admins are covered by the separate "Admins can update all payments" policy
    );
