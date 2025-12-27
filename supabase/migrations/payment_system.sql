-- Department-Based Payment Management System Migration
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. CREATE DEPARTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    department_head_id UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

-- =====================================================
-- 2. CREATE PAYMENT CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_categories_name ON payment_categories(name);

-- =====================================================
-- 3. CREATE DEPARTMENT PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS department_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    
    -- Payment Type
    payment_type TEXT NOT NULL CHECK (payment_type IN ('one-time', 'recurring')),
    
    -- Basic Info
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Amount
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    
    -- Recurring Payment Fields
    recurrence_period TEXT CHECK (recurrence_period IN ('monthly', 'quarterly', 'yearly')),
    next_payment_due DATE,
    last_payment_date DATE,
    
    -- One-time Payment Fields
    payment_date DATE,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    
    -- Additional Info,
    issuer_name TEXT,
    issuer_phone_number TEXT,
    issuer_address TEXT,
    payment_reference TEXT,
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_department_payments_department ON department_payments(department_id);
CREATE INDEX IF NOT EXISTS idx_department_payments_status ON department_payments(status);
CREATE INDEX IF NOT EXISTS idx_department_payments_type ON department_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_department_payments_category ON department_payments(category);
CREATE INDEX IF NOT EXISTS idx_department_payments_next_due ON department_payments(next_payment_due);

-- =====================================================
-- 4. CREATE PAYMENT DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES department_payments(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'receipt', 'requisition', 'approval', 'other')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_documents_payment ON payment_documents(payment_id);

-- =====================================================
-- 5. CREATE UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to departments
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to department_payments
DROP TRIGGER IF EXISTS update_department_payments_updated_at ON department_payments;
CREATE TRIGGER update_department_payments_updated_at
    BEFORE UPDATE ON department_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DEPARTMENTS POLICIES
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
-- PAYMENT CATEGORIES POLICIES
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
-- DEPARTMENT PAYMENTS POLICIES
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
-- PAYMENT DOCUMENTS POLICIES
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
-- 7. INSERT SOME PREDEFINED CATEGORIES (OPTIONAL)
-- =====================================================
INSERT INTO payment_categories (name) VALUES
    ('Starlink'),
    ('Internet'),
    ('Rent'),
    ('Utilities'),
    ('Office Supplies'),
    ('Software Subscriptions'),
    ('Equipment'),
    ('Maintenance'),
    ('Insurance'),
    ('Salaries')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- You can now use the payment management system!
