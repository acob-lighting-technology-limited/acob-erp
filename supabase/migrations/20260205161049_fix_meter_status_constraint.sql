-- Migration: Relax meters.status constraint
-- To allow 'active' and 'inactive' values from Odyssey API

ALTER TABLE public.meters DROP CONSTRAINT IF EXISTS meters_status_check;

ALTER TABLE public.meters ADD CONSTRAINT meters_status_check 
CHECK (status::text = ANY (ARRAY['online'::text, 'offline'::text, 'active'::text, 'inactive'::text]));

-- Log the migration success
INSERT INTO audit_logs (operation, table_name, status, metadata)
VALUES ('update_schema', 'meters', 'success', '{"description": "Relaxed meters_status_check constraint"}');
;
