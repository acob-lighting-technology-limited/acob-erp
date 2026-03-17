-- Create payment_categories table (for tracking unique categories across system)
CREATE TABLE IF NOT EXISTS public.payment_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.payment_categories IS 'Auto-populated list of payment categories used across the system';

-- Create department_payments table
CREATE TABLE IF NOT EXISTS public.department_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    
    -- Payment details
    payment_type TEXT NOT NULL CHECK (payment_type IN ('one-time', 'recurring')),
    category TEXT NOT NULL, -- User enters this freely (e.g., 'Starlink', 'Internet', 'Rent')
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    
    -- Recurring payment fields (null for one-time)
    recurrence_period TEXT CHECK (recurrence_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    next_payment_due TIMESTAMPTZ,
    last_payment_date TIMESTAMPTZ,
    
    -- One-time payment fields (null for recurring)
    payment_date TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    
    -- Documents and tracking
    invoice_number TEXT,
    payment_reference TEXT,
    notes TEXT,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.department_payments IS 'Department-based payment tracking system supporting one-time and recurring payments';

-- Create payment_documents table
CREATE TABLE IF NOT EXISTS public.payment_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.department_payments(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'receipt', 'requisition', 'approval', 'other')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size BIGINT,
    mime_type TEXT,
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.payment_documents IS 'Documents attached to department payments';

-- Create indexes
CREATE INDEX idx_dept_payments_department ON public.department_payments(department_id);
CREATE INDEX idx_dept_payments_type ON public.department_payments(payment_type);
CREATE INDEX idx_dept_payments_category ON public.department_payments(category);
CREATE INDEX idx_dept_payments_status ON public.department_payments(status);
CREATE INDEX idx_dept_payments_next_due ON public.department_payments(next_payment_due);
CREATE INDEX idx_dept_payments_created_by ON public.department_payments(created_by);
CREATE INDEX idx_payment_docs_payment ON public.payment_documents(payment_id);

-- Enable RLS
ALTER TABLE public.payment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_categories
CREATE POLICY "Anyone can view categories"
    ON public.payment_categories FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policies for department_payments
CREATE POLICY "Users can view payments in their department or all if admin"
    ON public.department_payments FOR SELECT
    TO authenticated
    USING (
        -- Admins can see all
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
        OR
        -- Users can see their department's payments
        department_id IN (
            SELECT d.id FROM public.departments d
            JOIN public.profiles p ON p.department = d.name
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can create payments in their department or any if admin"
    ON public.department_payments FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Admins can create in any department
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
        OR
        -- Users can only create in their own department
        department_id IN (
            SELECT d.id FROM public.departments d
            JOIN public.profiles p ON p.department = d.name
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can update payments in their department or all if admin"
    ON public.department_payments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
        OR
        department_id IN (
            SELECT d.id FROM public.departments d
            JOIN public.profiles p ON p.department = d.name
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Only admins can delete payments"
    ON public.department_payments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- RLS Policies for payment_documents
CREATE POLICY "Users can view documents for payments they can see"
    ON public.payment_documents FOR SELECT
    TO authenticated
    USING (
        payment_id IN (
            SELECT id FROM public.department_payments
        )
    );

CREATE POLICY "Users can upload documents to payments they can access"
    ON public.payment_documents FOR INSERT
    TO authenticated
    WITH CHECK (
        payment_id IN (
            SELECT id FROM public.department_payments
        )
    );

CREATE POLICY "Users can delete their own uploaded documents or admins can delete any"
    ON public.payment_documents FOR DELETE
    TO authenticated
    USING (
        uploaded_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Triggers
CREATE OR REPLACE FUNCTION public.handle_dept_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_dept_payments_updated_at
    BEFORE UPDATE ON public.department_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_dept_payments_updated_at();

-- Function to auto-populate payment_categories
CREATE OR REPLACE FUNCTION public.auto_add_payment_category()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.payment_categories (name)
    VALUES (NEW.category)
    ON CONFLICT (name) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER populate_payment_categories
    AFTER INSERT OR UPDATE OF category ON public.department_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_add_payment_category();;
