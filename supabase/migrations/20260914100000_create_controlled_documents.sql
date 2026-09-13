-- Controlled documents: company policies and standard operating procedures.
--
-- The files themselves live in SharePoint (site "department-documents",
-- library "Documents"). These tables are the control layer SharePoint does
-- not give us: a stable reference code, an owner, a review date, a publish
-- lifecycle, an append-only version history, and — for policies — a record
-- of which staff acknowledged which version.
--
-- Visibility:
--   policy  published → every authenticated user.
--   sop     published → company-wide SOPs to everyone; department SOPs to
--           staff of the tagged departments.
--   Admins see everything; a department lead also sees drafts/retired SOPs
--   their department owns.
--
-- All writes go through server API routes using the service-role client.
-- The write policies below are the backstop, not the app's data path.

CREATE TABLE IF NOT EXISTS public.controlled_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type           text NOT NULL,
  reference_code     text NOT NULL UNIQUE,
  title              text NOT NULL,
  description        text,
  category           text,
  owner_department   text,
  is_company_wide    boolean NOT NULL DEFAULT true,
  departments        text[] NOT NULL DEFAULT ARRAY[]::text[],
  status             text NOT NULL DEFAULT 'draft',
  next_review_date   date,
  current_version_id uuid,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at       timestamptz,
  retired_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT controlled_documents_type_check CHECK (doc_type IN ('policy', 'sop')),
  CONSTRAINT controlled_documents_status_check CHECK (status IN ('draft', 'published', 'retired')),
  -- Policies are company-wide by definition; only SOPs are department-tagged.
  CONSTRAINT controlled_documents_policy_company_wide CHECK (doc_type = 'sop' OR is_company_wide),
  CONSTRAINT controlled_documents_sop_audience CHECK (is_company_wide OR cardinality(departments) > 0)
);

COMMENT ON TABLE public.controlled_documents IS
  'Company policies and SOPs. Metadata and lifecycle only — the file for each version is stored in SharePoint.';
COMMENT ON COLUMN public.controlled_documents.departments IS
  'SOP audience when is_company_wide is false. Matches profiles.department names.';
COMMENT ON COLUMN public.controlled_documents.owner_department IS
  'Department accountable for the document. Its lead may manage the SOP.';

CREATE TABLE IF NOT EXISTS public.controlled_document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES public.controlled_documents(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  effective_date  date NOT NULL,
  change_summary  text,
  file_name       text NOT NULL,
  file_path       text NOT NULL,
  mime_type       text,
  file_size       bigint,
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT controlled_document_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT controlled_document_versions_unique UNIQUE (document_id, version_number)
);

COMMENT ON TABLE public.controlled_document_versions IS
  'Append-only version history. file_path is the SharePoint path (/Documents/...).';

ALTER TABLE public.controlled_documents
  DROP CONSTRAINT IF EXISTS controlled_documents_current_version_fk;
ALTER TABLE public.controlled_documents
  ADD CONSTRAINT controlled_documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.controlled_document_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.controlled_document_acknowledgements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES public.controlled_documents(id) ON DELETE CASCADE,
  version_id      uuid NOT NULL REFERENCES public.controlled_document_versions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT controlled_document_acknowledgements_unique UNIQUE (version_id, user_id)
);

COMMENT ON TABLE public.controlled_document_acknowledgements IS
  'Evidence that a staff member confirmed reading a specific policy version. A new version needs a new acknowledgement.';

CREATE INDEX IF NOT EXISTS idx_controlled_documents_type_status ON public.controlled_documents (doc_type, status);
CREATE INDEX IF NOT EXISTS idx_controlled_documents_departments ON public.controlled_documents USING gin (departments);
CREATE INDEX IF NOT EXISTS idx_controlled_document_versions_document ON public.controlled_document_versions (document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_controlled_document_acks_user ON public.controlled_document_acknowledgements (user_id);
CREATE INDEX IF NOT EXISTS idx_controlled_document_acks_version ON public.controlled_document_acknowledgements (version_id);

DROP TRIGGER IF EXISTS update_controlled_documents_updated_at ON public.controlled_documents;
CREATE TRIGGER update_controlled_documents_updated_at
  BEFORE UPDATE ON public.controlled_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.controlled_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controlled_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controlled_document_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Controlled documents select visible" ON public.controlled_documents;
CREATE POLICY "Controlled documents select visible"
ON public.controlled_documents FOR SELECT TO authenticated
USING (
  (SELECT public.has_role('admin'))
  OR (
    status = 'published'
    AND (
      doc_type = 'policy'
      OR is_company_wide
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.department = ANY(controlled_documents.departments)
      )
    )
  )
  OR (
    doc_type = 'sop'
    AND owner_department IS NOT NULL
    AND (SELECT public.is_lead_for_department(owner_department))
  )
);

DROP POLICY IF EXISTS "Controlled documents write admin" ON public.controlled_documents;
CREATE POLICY "Controlled documents write admin"
ON public.controlled_documents FOR ALL TO authenticated
USING ((SELECT public.has_role('admin')))
WITH CHECK ((SELECT public.has_role('admin')));

-- A version is visible exactly when its document is: the subquery runs under
-- the caller's RLS on controlled_documents.
DROP POLICY IF EXISTS "Controlled document versions select visible" ON public.controlled_document_versions;
CREATE POLICY "Controlled document versions select visible"
ON public.controlled_document_versions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.controlled_documents d
    WHERE d.id = controlled_document_versions.document_id
  )
);

DROP POLICY IF EXISTS "Controlled document versions write admin" ON public.controlled_document_versions;
CREATE POLICY "Controlled document versions write admin"
ON public.controlled_document_versions FOR ALL TO authenticated
USING ((SELECT public.has_role('admin')))
WITH CHECK ((SELECT public.has_role('admin')));

DROP POLICY IF EXISTS "Controlled document acknowledgements select own or admin" ON public.controlled_document_acknowledgements;
CREATE POLICY "Controlled document acknowledgements select own or admin"
ON public.controlled_document_acknowledgements FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (SELECT public.has_role('admin')));

DROP POLICY IF EXISTS "Controlled document acknowledgements insert own" ON public.controlled_document_acknowledgements;
CREATE POLICY "Controlled document acknowledgements insert own"
ON public.controlled_document_acknowledgements FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.controlled_documents d
    WHERE d.id = controlled_document_acknowledgements.document_id
      AND d.current_version_id = controlled_document_acknowledgements.version_id
      AND d.status = 'published'
      AND d.doc_type = 'policy'
  )
);

REVOKE ALL ON public.controlled_documents FROM anon;
REVOKE ALL ON public.controlled_document_versions FROM anon;
REVOKE ALL ON public.controlled_document_acknowledgements FROM anon;
