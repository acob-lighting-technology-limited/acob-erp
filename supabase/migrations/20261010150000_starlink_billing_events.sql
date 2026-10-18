-- Starlink billing email sync: one row per billing email read from the ict
-- mailbox, so each email is filed once and a run can retry the ones it could
-- not place yet (e.g. a "Payment Processed" whose invoice has not arrived).

CREATE TABLE IF NOT EXISTS public.starlink_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_message_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('reminder', 'processed', 'failed')),
  received_at TIMESTAMPTZ NOT NULL,
  account_number TEXT,
  invoice_number TEXT,
  amount NUMERIC(15, 2),
  currency TEXT,
  period_start DATE,
  period_end DATE,
  site_id UUID REFERENCES public.starlink_sites(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.department_payments(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.payment_documents(id) ON DELETE SET NULL,
  -- applied: filed / recorded. already_recorded: the month was already on file.
  -- unmatched: no kit or payment for the account. waiting: retried next run.
  outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'already_recorded', 'unmatched', 'waiting', 'error')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.starlink_billing_events IS
  'Starlink billing emails (reminder / processed / failed) read from the ict mailbox and filed against kit payments.';

CREATE INDEX IF NOT EXISTS idx_starlink_billing_events_site ON public.starlink_billing_events(site_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_starlink_billing_events_invoice ON public.starlink_billing_events(invoice_number);
CREATE INDEX IF NOT EXISTS idx_starlink_billing_events_outcome ON public.starlink_billing_events(outcome)
  WHERE outcome IN ('waiting', 'error');

ALTER TABLE public.starlink_billing_events ENABLE ROW LEVEL SECURITY;

-- Written only by the sync (service role). Admins may read it.
DROP POLICY IF EXISTS "Starlink billing events admin read" ON public.starlink_billing_events;
CREATE POLICY "Starlink billing events admin read" ON public.starlink_billing_events
  FOR SELECT TO authenticated
  USING (public.is_admin_like());

-- Login emails for the two kits added without one, read off their Starlink emails.
UPDATE public.starlink_sites SET email = 'adebayo@org.acoblighting.com', notes = NULL, updated_at = now()
WHERE serial_number = 'ACC-3038459-10152-6' AND email IS NULL;
UPDATE public.starlink_sites SET email = 'tunga@org.acoblighting.com', notes = NULL, updated_at = now()
WHERE serial_number = 'ACC-DF-10027839-61596-53' AND email IS NULL;

-- Hourly at :20, through the same app-endpoint caller as the other app jobs.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'app-starlink-billing-sync';
SELECT cron.schedule(
  'app-starlink-billing-sync', '20 * * * *',
  $job$select public.call_app_endpoint('/api/cron/starlink/billing-sync', 'GET')$job$
);
