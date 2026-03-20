DROP INDEX IF EXISTS public.idx_correspondence_records_incoming_ref;

ALTER TABLE public.correspondence_records
DROP COLUMN IF EXISTS incoming_reference_id;
