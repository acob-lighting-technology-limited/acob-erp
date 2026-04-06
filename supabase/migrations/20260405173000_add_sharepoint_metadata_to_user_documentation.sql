ALTER TABLE public.user_documentation
ADD COLUMN IF NOT EXISTS sharepoint_folder_path TEXT,
ADD COLUMN IF NOT EXISTS sharepoint_text_file_path TEXT,
ADD COLUMN IF NOT EXISTS sharepoint_attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
