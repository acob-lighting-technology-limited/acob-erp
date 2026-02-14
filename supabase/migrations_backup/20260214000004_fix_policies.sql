-- Fix for duplicate policy error
-- This script will drop and recreate policies that might already exist
-- Run this ONLY if you got the "policy already exists" error

-- =====================================================
-- DROP EXISTING POLICIES (if they exist)
-- =====================================================

-- Drop department_payments policies
DROP POLICY IF EXISTS "Admins can view all payments" ON department_payments;
DROP POLICY IF EXISTS "Users can view their department payments" ON department_payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON department_payments;
DROP POLICY IF EXISTS "Users can insert payments in their department" ON department_payments;
DROP POLICY IF EXISTS "Admins can update all payments" ON department_payments;
DROP POLICY IF EXISTS "Users can update their department payments" ON department_payments;
DROP POLICY IF EXISTS "Only admins can delete payments" ON department_payments;

-- Drop payment_documents policies
DROP POLICY IF EXISTS "Users can view payment documents" ON payment_documents;
DROP POLICY IF EXISTS "Users can upload payment documents" ON payment_documents;
DROP POLICY IF EXISTS "Users can delete their uploaded documents" ON payment_documents;
DROP POLICY IF EXISTS "Admins can delete any payment document" ON payment_documents;

-- Drop departments policies
DROP POLICY IF EXISTS "Anyone can view active departments" ON departments;
DROP POLICY IF EXISTS "Admins can insert departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Drop payment_categories policies
DROP POLICY IF EXISTS "Anyone can view payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON payment_categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON payment_categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON payment_categories;

-- =====================================================
-- RECREATE DEPARTMENT PAYMENTS POLICIES
-- =====================================================

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
    ON department_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Users can view payments in their department
CREATE POLICY "Users can view their department payments"
    ON department_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            JOIN departments ON departments.name = profiles.department
            WHERE profiles.id = auth.uid()
            AND departments.id = department_payments.department_id
        )
    );

-- Admins can insert payments in any department
CREATE POLICY "Admins can insert payments"
    ON department_payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Users can insert payments in their own department
CREATE POLICY "Users can insert payments in their department"
    ON department_payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            JOIN departments ON departments.name = profiles.department
            WHERE profiles.id = auth.uid()
            AND departments.id = department_payments.department_id
        )
    );

-- Admins can update all payments
CREATE POLICY "Admins can update all payments"
    ON department_payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Users can update payments in their department
CREATE POLICY "Users can update their department payments"
    ON department_payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            JOIN departments ON departments.name = profiles.department
            WHERE profiles.id = auth.uid()
            AND departments.id = department_payments.department_id
        )
    );

-- Only admins can delete payments
CREATE POLICY "Only admins can delete payments"
    ON department_payments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- =====================================================
-- RECREATE PAYMENT DOCUMENTS POLICIES
-- =====================================================

-- Users can view documents for payments they can see
CREATE POLICY "Users can view payment documents"
    ON payment_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM department_payments
            WHERE department_payments.id = payment_documents.payment_id
        )
    );

-- Users can upload documents for payments they can access
CREATE POLICY "Users can upload payment documents"
    ON payment_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM department_payments
            WHERE department_payments.id = payment_documents.payment_id
        )
    );

-- Users can delete their own uploaded documents
CREATE POLICY "Users can delete their uploaded documents"
    ON payment_documents FOR DELETE
    USING (uploaded_by = auth.uid());

-- Admins can delete any document
CREATE POLICY "Admins can delete any payment document"
    ON payment_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- =====================================================
-- RECREATE DEPARTMENTS POLICIES
-- =====================================================

-- Everyone can view active departments
CREATE POLICY "Anyone can view active departments"
    ON departments FOR SELECT
    USING (is_active = true);

-- Only admins can insert departments
CREATE POLICY "Admins can insert departments"
    ON departments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Only admins can update departments
CREATE POLICY "Admins can update departments"
    ON departments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Only admins can delete departments
CREATE POLICY "Admins can delete departments"
    ON departments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- =====================================================
-- RECREATE PAYMENT CATEGORIES POLICIES
-- =====================================================

-- Everyone can view categories
CREATE POLICY "Anyone can view payment categories"
    ON payment_categories FOR SELECT
    USING (true);

-- Authenticated users can insert categories
CREATE POLICY "Authenticated users can insert categories"
    ON payment_categories FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update categories
CREATE POLICY "Authenticated users can update categories"
    ON payment_categories FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete categories
CREATE POLICY "Authenticated users can delete categories"
    ON payment_categories FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- POLICIES FIXED!
-- =====================================================
