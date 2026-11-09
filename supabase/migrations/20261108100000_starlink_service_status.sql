-- Starlink service status: "Service Activation Confirmation" and "Service Ending
-- Soon" emails are logged too, and a kit remembers its last day of service.

ALTER TABLE public.starlink_billing_events DROP CONSTRAINT IF EXISTS starlink_billing_events_kind_check;
ALTER TABLE public.starlink_billing_events ADD CONSTRAINT starlink_billing_events_kind_check
  CHECK (kind IN ('reminder', 'processed', 'failed', 'activated', 'ending'));

-- Set by a "Service Ending" email, cleared by a later "Service Activation". Kit
-- deactivation stays a manual choice (is_active).
ALTER TABLE public.starlink_sites ADD COLUMN IF NOT EXISTS service_end_date DATE;
