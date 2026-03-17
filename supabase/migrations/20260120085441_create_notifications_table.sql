
-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'token_generated',
    'token_cancelled',
    'task_completed',
    'task_failed',
    'customer_added',
    'customer_updated',
    'meter_status_change',
    'meter_added',
    'activity_reminder',
    'crm_contact_added',
    'opportunity_won',
    'opportunity_lost',
    'system_alert'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);
;
