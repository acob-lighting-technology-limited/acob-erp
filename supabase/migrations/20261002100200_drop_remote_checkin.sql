-- Remove remote check-in (audit A7 — feature retired by the business).
--
-- Live state before this migration: 0 attendance records with source 'remote_web',
-- 0 profiles with remote_checkin_enabled. The app no longer has the remote
-- clock-in/out routes, the nearest-site lookup, the remote-access admin page or
-- the site-locations admin page, so the backing columns and table are dropped.

BEGIN;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS remote_checkin_enabled,
  DROP COLUMN IF EXISTS face_reference_url;

ALTER TABLE public.attendance_records
  DROP COLUMN IF EXISTS selfie_url,
  DROP COLUMN IF EXISTS selfie_out_url,
  DROP COLUMN IF EXISTS face_match_confidence,
  DROP COLUMN IF EXISTS face_verified,
  DROP COLUMN IF EXISTS location_verified,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS site_id;

DROP TABLE IF EXISTS public.attendance_sites CASCADE;

COMMIT;
