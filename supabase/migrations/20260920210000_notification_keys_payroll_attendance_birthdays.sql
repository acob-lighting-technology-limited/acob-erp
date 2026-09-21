-- ---------------------------------------------------------------------------
-- Mail Settings claimed to govern notification email "system-wide" while three
-- streams sent outside any policy: payslips, attendance mail and birthday
-- wishes. Each gets a key so the admin page can actually switch it off.
--
-- 'approvals' already existed as a row but nothing read it - correspondence
-- decision mail now does, so the toggle stops being decorative.
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_delivery_policies
  DROP CONSTRAINT IF EXISTS notification_delivery_policies_key_check;

ALTER TABLE public.notification_delivery_policies
  ADD CONSTRAINT notification_delivery_policies_key_check
  CHECK (notification_key = ANY (ARRAY[
    'onboarding', 'help_desk', 'leave', 'assets', 'meetings',
    'communications', 'reports', 'system', 'approvals', 'tasks',
    'payroll', 'attendance', 'birthdays'
  ]));

-- Defaults match every other row: enabled on both channels, not mandatory.
-- These streams have been sending all along, so anything else would be a
-- silent behaviour change dressed up as a migration.
INSERT INTO public.notification_delivery_policies (notification_key)
VALUES ('payroll'), ('attendance'), ('birthdays')
ON CONFLICT (notification_key) DO NOTHING;
