-- Create notification_escalation_rules table to replace hardcoded department
-- names in asset_notification_requester_kind and
-- resolve_asset_notification_escalation_recipient functions.
--
-- Current functions use hardcoded 'Executive Management' and 'Corporate Services'.
-- This table makes those values data-driven.
--
-- TODO: Once this table is verified in production, update
--   public.asset_notification_requester_kind() and
--   public.resolve_asset_notification_escalation_recipient()
--   to SELECT department_name FROM notification_escalation_rules WHERE escalation_level = N
--   instead of the hardcoded string literals.

CREATE TABLE IF NOT EXISTS public.notification_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_level INT NOT NULL,
  department_name TEXT NOT NULL,
  role_code TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.notification_escalation_rules
  (escalation_level, department_name, role_code, description)
VALUES
  (1, 'Corporate Services', 'head_corporate_services', 'Head of Corporate Services'),
  (2, 'Executive Management', 'managing_director', 'Managing Director');

ALTER TABLE public.notification_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalation_rules_select" ON public.notification_escalation_rules
  FOR SELECT TO authenticated USING (true);
