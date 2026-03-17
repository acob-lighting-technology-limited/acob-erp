-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    department_head_id UUID REFERENCES public.profiles(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.departments IS 'Master list of company departments';

-- Insert existing departments from profiles
INSERT INTO public.departments (name)
SELECT DISTINCT department
FROM public.profiles
WHERE department IS NOT NULL
ORDER BY department
ON CONFLICT (name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_active ON public.departments(is_active);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all users to view departments"
    ON public.departments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Only admins can insert departments"
    ON public.departments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Only admins can update departments"
    ON public.departments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Only admins can delete departments"
    ON public.departments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_departments_updated_at
    BEFORE UPDATE ON public.departments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_departments_updated_at();;
