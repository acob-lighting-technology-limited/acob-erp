-- ============================================
-- Core Types
-- ============================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('visitor', 'employee', 'lead', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  department_head_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  other_names TEXT,
  full_name TEXT,
  department TEXT,
  department_id UUID REFERENCES public.departments(id),
  company_role TEXT,
  company_email TEXT,
  phone_number TEXT,
  additional_phone TEXT,
  residential_address TEXT,
  current_work_location TEXT,
  office_location TEXT,
  device_allocated TEXT,
  device_type TEXT,
  device_model TEXT,
  employee_number TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_department_lead BOOLEAN DEFAULT FALSE,
  role user_role DEFAULT 'employee',
  lead_departments TEXT[] DEFAULT '{}',
  job_description TEXT,
  job_description_updated_at TIMESTAMPTZ,
  employment_date DATE,
  date_of_birth DATE,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  status_changed_by UUID REFERENCES public.profiles(id),
  devices JSONB,
  email_notifications BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Office Locations Table
CREATE TABLE IF NOT EXISTS public.office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  department TEXT,
  site TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Starlink System (Legacy referencing tables)
CREATE TABLE IF NOT EXISTS public.starlink_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  site_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  migrated_to_department_payments BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.starlink_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.starlink_sites(id),
  invoice_number TEXT NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  next_payment_due DATE NOT NULL,
  amount NUMERIC,
  currency TEXT,
  payment_status TEXT NOT NULL,
  payment_date DATE,
  payment_reference TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  requisition_raised BOOLEAN NOT NULL DEFAULT FALSE,
  requisition_raised_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.starlink_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.starlink_payments(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed basic departments
INSERT INTO public.departments (name, description) VALUES
('IT and Communications', 'Information Technology and Communications Department'),
('Accounts', 'Finance and Accounting Department'),
('Admin & HR', 'Administration and Human Resources Department'),
('Operations', 'Operations Department'),
('Legal, Regulatory and Compliance', 'Legal and Compliance Department'),
('Business, Growth and Innovation', 'Business Development Department'),
('Technical', 'Technical Services Department')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starlink_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starlink_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starlink_documents ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
