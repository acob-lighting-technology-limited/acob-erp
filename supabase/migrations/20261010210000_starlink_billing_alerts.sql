-- Starlink billing alerts: who is told when a kit's payment fails or its bill is
-- coming due. Recipients live in system_settings ('starlink_billing_alerts'),
-- edited from Accounts > Starlink Kits > Alerts.

-- When a failure alert went out for this email, and the billing month a
-- "Payment Failed" belongs to (the kit's latest bill before it), so one alert
-- covers a month however many retries fail.
ALTER TABLE public.starlink_billing_events ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ;

UPDATE public.starlink_billing_events f
SET period_start = (
  SELECT r.period_start
  FROM public.starlink_billing_events r
  WHERE r.kind = 'reminder'
    AND r.site_id = f.site_id
    AND r.period_start IS NOT NULL
    AND r.received_at <= f.received_at
  ORDER BY r.received_at DESC
  LIMIT 1
)
WHERE f.kind = 'failed' AND f.period_start IS NULL AND f.site_id IS NOT NULL;

-- Failures already on file are history, not news: don't alert on them.
UPDATE public.starlink_billing_events SET alerted_at = now()
WHERE kind = 'failed' AND alerted_at IS NULL;

-- The due date a "bill coming due" alert was last sent for, so each bill is
-- announced once.
ALTER TABLE public.starlink_sites ADD COLUMN IF NOT EXISTS due_alert_sent_for DATE;
