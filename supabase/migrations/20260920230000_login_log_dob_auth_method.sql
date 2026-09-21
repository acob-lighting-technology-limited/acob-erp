-- The CBT session route verifies a candidate either by password or by last
-- name + date of birth. Only the password branch wrote a dev_login_logs row,
-- so the weaker of the two methods left no audit trail at all.
--
-- Widen the auth_method check so the date-of-birth path can record itself
-- distinctly, rather than borrowing 'password' and misreporting how the
-- candidate was verified.
--
-- Must be applied before the code that writes 'dob' ships, or those inserts
-- fail the constraint and the login log silently stays empty for that path.

ALTER TABLE public.dev_login_logs
  DROP CONSTRAINT IF EXISTS dev_login_logs_auth_method_chk;

ALTER TABLE public.dev_login_logs
  ADD CONSTRAINT dev_login_logs_auth_method_chk
  CHECK (auth_method IS NULL OR auth_method = ANY (ARRAY['password'::text, 'otp'::text, 'dob'::text]));
