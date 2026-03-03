-- Strengthen audit row quality for all new writes and improve lookup performance.

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_nonempty_chk
  CHECK (action IS NOT NULL AND btrim(action) <> '') NOT VALID;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_entity_type_nonempty_chk
  CHECK (entity_type IS NOT NULL AND btrim(entity_type) <> '') NOT VALID;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_entity_id_nonempty_chk
  CHECK (entity_id IS NOT NULL AND btrim(entity_id) <> '') NOT VALID;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id_created_at
  ON public.audit_logs (entity_type, entity_id, created_at DESC);
