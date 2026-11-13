-- public.token_records is a leftover from the old CRM: empty, unused by any code,
-- no realtime subscribers. Keeping it in the supabase_realtime publication made the
-- Realtime service poll the WAL constantly (1.29M polls since 21 Oct) on a tiny
-- instance. Already applied to production by SQL on 2026-11-13; this migration makes
-- the repo match prod and is a no-op where the table is already out of the publication.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'token_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.token_records;
  END IF;
END
$$;
