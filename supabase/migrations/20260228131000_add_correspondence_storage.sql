-- Storage bucket and policies for correspondence documents

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'correspondence_documents',
  'correspondence_documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Correspondence objects read'
  ) THEN
    CREATE POLICY "Correspondence objects read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'correspondence_documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Correspondence objects insert'
  ) THEN
    CREATE POLICY "Correspondence objects insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'correspondence_documents'
      AND owner = auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Correspondence objects update'
  ) THEN
    CREATE POLICY "Correspondence objects update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'correspondence_documents'
      AND owner = auth.uid()
    )
    WITH CHECK (
      bucket_id = 'correspondence_documents'
      AND owner = auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Correspondence objects delete'
  ) THEN
    CREATE POLICY "Correspondence objects delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'correspondence_documents'
      AND owner = auth.uid()
    );
  END IF;
END $$;
