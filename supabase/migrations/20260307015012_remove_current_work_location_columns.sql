-- Remove deprecated work location column; office_location is now the single source of truth.
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS current_work_location;

ALTER TABLE public.pending_users
DROP COLUMN IF EXISTS current_work_location;;
