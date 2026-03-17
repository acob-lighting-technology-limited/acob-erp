CREATE TABLE IF NOT EXISTS public.reminder_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_type TEXT NOT NULL,
    reminder_type TEXT NOT NULL,
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    send_day TEXT,
    send_time TIME,
    meeting_config JSONB,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reminder_schedules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access for now (consistent with project pattern)
CREATE POLICY "Allow authenticated users full access on reminder_schedules"
ON public.reminder_schedules
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER TABLE public.reminder_schedules REPLICA IDENTITY FULL;
-- Note: Realtime might need to be enabled at the publication level if not already done for public schema.
;
