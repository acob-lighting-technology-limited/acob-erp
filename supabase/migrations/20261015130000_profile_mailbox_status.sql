-- Whether Matrix managed to create an employee's company mailbox on cPanel.
-- Set on approval (mailbox created automatically) and on "Send webmail
-- credentials" (create or reset). NULL = never attempted by Matrix (staff
-- onboarded before this, or ICT set the mailbox up by hand).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mailbox_status text,
  ADD COLUMN IF NOT EXISTS mailbox_error text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_mailbox_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_mailbox_status_check CHECK (mailbox_status IS NULL OR mailbox_status IN ('created', 'failed'));

COMMENT ON COLUMN public.profiles.mailbox_status IS 'cPanel mailbox provisioning outcome: created | failed | NULL (not attempted by Matrix)';
COMMENT ON COLUMN public.profiles.mailbox_error IS 'cPanel''s reason when mailbox_status = failed';
