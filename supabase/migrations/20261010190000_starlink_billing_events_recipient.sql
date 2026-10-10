-- The kit login a Starlink billing email was sent to (the forwarded To:), so a
-- Starlink account the matrix has not seen before can be added as a kit with
-- its login email filled in.
ALTER TABLE public.starlink_billing_events ADD COLUMN IF NOT EXISTS recipient_email TEXT;
CREATE INDEX IF NOT EXISTS idx_starlink_billing_events_unmatched
  ON public.starlink_billing_events(account_number) WHERE outcome = 'unmatched';
