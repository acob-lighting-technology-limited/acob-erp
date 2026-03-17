
-- Table for storing scheduled and recurring digest email configurations
CREATE TABLE IF NOT EXISTS public.digest_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_type text NOT NULL CHECK (schedule_type IN ('one_time', 'recurring')),
  meeting_week int,
  meeting_year int,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_choice text NOT NULL DEFAULT 'both' CHECK (content_choice IN ('both', 'weekly_report', 'action_tracker')),
  send_day text DEFAULT 'monday' CHECK (send_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  send_time time DEFAULT '09:00',
  timezone text DEFAULT 'Africa/Lagos',
  is_active boolean DEFAULT true,
  last_sent_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digest_schedules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage schedules
CREATE POLICY "Admins can manage digest schedules"
  ON public.digest_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Index for cron job to find due schedules quickly
CREATE INDEX idx_digest_schedules_active_next ON public.digest_schedules (is_active, next_run_at)
  WHERE is_active = true;
;
