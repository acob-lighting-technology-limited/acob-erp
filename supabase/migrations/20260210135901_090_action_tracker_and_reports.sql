-- Enable the action point and weekly reports features

-- 1. Enhance tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS week_number integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS year integer;

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_week_year ON tasks(year, week_number);

-- 2. Create weekly_reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    department text NOT NULL,
    week_number integer NOT NULL,
    year integer NOT NULL,
    work_done text,
    tasks_new_week text,
    challenges text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(department, week_number, year)
);

-- 3. Enable RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for weekly_reports
-- Everyone can view submitted reports
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone can view submitted reports') THEN
        CREATE POLICY "Everyone can view submitted reports" ON weekly_reports
            FOR SELECT USING (status = 'submitted' OR auth.uid() = user_id);
    END IF;
END $$;

-- Leads and Admin can manage their own reports
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Leads can manage their own reports') THEN
        CREATE POLICY "Leads can manage their own reports" ON weekly_reports
            FOR ALL USING (
                auth.uid() = user_id OR 
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
                )
            );
    END IF;
END $$;

-- 5. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_weekly_reports_updated_at') THEN
        CREATE TRIGGER update_weekly_reports_updated_at
            BEFORE UPDATE ON weekly_reports
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
;
