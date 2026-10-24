-- ─────────────────────────────────────────────────────────────
-- Project Mailboxes
--
-- Enables projects to own dedicated company mailboxes (e.g. project operations,
-- site dispatch, or public correspondence for a specific project).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_mailboxes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Case-insensitive unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_mailboxes_email_lower
  ON public.project_mailboxes (lower(email));

CREATE INDEX IF NOT EXISTS idx_project_mailboxes_project_id
  ON public.project_mailboxes (project_id);

COMMENT ON TABLE public.project_mailboxes IS 'Links company mailboxes directly to projects.';

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.project_mailboxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project mailboxes authenticated select" ON public.project_mailboxes;
CREATE POLICY "Project mailboxes authenticated select"
ON public.project_mailboxes FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Project mailboxes admin write" ON public.project_mailboxes;
CREATE POLICY "Project mailboxes admin write"
ON public.project_mailboxes FOR ALL TO authenticated
USING (public.is_admin_like())
WITH CHECK (public.is_admin_like());

REVOKE ALL ON public.project_mailboxes FROM anon;
GRANT SELECT ON public.project_mailboxes TO authenticated;
GRANT ALL ON public.project_mailboxes TO service_role;

NOTIFY pgrst, 'reload schema';
