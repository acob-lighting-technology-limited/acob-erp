-- ---------------------------------------------------------------------------
-- Add 'correspondence' and 'payments' as standalone notification keys in
-- notification_delivery_policies so both streams can be independently controlled
-- from Admin Mail Settings.
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_delivery_policies
  DROP CONSTRAINT IF EXISTS notification_delivery_policies_key_check;

ALTER TABLE public.notification_delivery_policies
  ADD CONSTRAINT notification_delivery_policies_key_check
  CHECK (notification_key = ANY (ARRAY[
    'onboarding', 'help_desk', 'leave', 'assets', 'meetings',
    'communications', 'reports', 'system', 'approvals', 'tasks',
    'payroll', 'attendance', 'birthdays', 'correspondence', 'payments'
  ]));

-- Defaults match every other row: enabled on in-app, email and push, not mandatory.
INSERT INTO public.notification_delivery_policies (notification_key)
VALUES ('correspondence'), ('payments')
ON CONFLICT (notification_key) DO NOTHING;
