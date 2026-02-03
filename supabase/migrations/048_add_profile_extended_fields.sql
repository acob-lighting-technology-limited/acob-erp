-- Create employment_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
        CREATE TYPE employment_status AS ENUM ('active', 'suspended', 'terminated', 'on_leave');
    END IF;
END $$;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS other_names TEXT,
ADD COLUMN IF NOT EXISTS company_role TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS additional_phone TEXT,
ADD COLUMN IF NOT EXISTS residential_address TEXT,
ADD COLUMN IF NOT EXISTS current_work_location TEXT,
ADD COLUMN IF NOT EXISTS office_location TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS employment_date DATE,
ADD COLUMN IF NOT EXISTS employment_status employment_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS termination_date DATE,
ADD COLUMN IF NOT EXISTS termination_reason TEXT;

-- Create employee_suspensions table if it doesn't exist
CREATE TABLE IF NOT EXISTS employee_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    suspended_by UUID NOT NULL REFERENCES profiles(id),
    reason TEXT NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    lifted_by UUID REFERENCES profiles(id),
    lifted_at TIMESTAMPTZ,
    lift_reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
