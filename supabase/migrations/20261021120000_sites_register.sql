-- ─────────────────────────────────────────────────────────────
-- Sites register
--
-- A site is a location the company has signed or profiled — from the first
-- exclusivity letter onwards, long before (and whether or not) a project is
-- built there. It replaces the separate Excel site lists: one register that
-- senior management can read without asking each department.
--
-- Conveyance documents (Exclusivity, MOU, NERC, NEMSA, …) are rows, not a
-- column, because the question the register exists to answer is "has any of
-- this site's paperwork expired?" — which needs an expiry date per document.
-- Expired / expiring is derived from expires_on on every read; nothing stored
-- can drift out of date.
--
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  lga          text,
  state        text,
  date_signed  date,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- The same community name recurs across states, so a site is unique by name
-- within its LGA and state, not by name alone.
CREATE UNIQUE INDEX IF NOT EXISTS sites_name_lga_state_unique
  ON public.sites (lower(name), lower(coalesce(lga, '')), lower(coalesce(state, '')));

CREATE INDEX IF NOT EXISTS idx_sites_portfolio_id ON public.sites (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_sites_project_id ON public.sites (project_id);

COMMENT ON TABLE public.sites IS 'Register of signed and profiled sites, with or without a project built on them.';

CREATE TABLE IF NOT EXISTS public.site_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  -- Only for document_type = 'other': what the document is.
  label         text,
  status        text NOT NULL DEFAULT 'pending',
  reference     text,
  issued_on     date,
  expires_on    date,
  notes         text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_documents_type_check
    CHECK (document_type IN ('exclusivity', 'mou', 'nerc', 'nemsa', 'other')),
  CONSTRAINT site_documents_status_check
    CHECK (status IN ('pending', 'obtained', 'not_required')),
  CONSTRAINT site_documents_other_label_check
    CHECK (document_type <> 'other' OR nullif(trim(label), '') IS NOT NULL),
  CONSTRAINT site_documents_dates_check
    CHECK (issued_on IS NULL OR expires_on IS NULL OR expires_on >= issued_on)
);

CREATE INDEX IF NOT EXISTS idx_site_documents_site_id ON public.site_documents (site_id);

COMMENT ON TABLE public.site_documents IS 'Conveyance documents per site. Expired/expiring is derived from expires_on at read time.';

-- ─────────────────────────────────────────────────────────────
-- RLS
--
-- Every read and write goes through /api/sites with the service-role client,
-- which serves the register to all staff and lets only admins change it. The
-- policies are the backstop for the direct PostgREST path: admins only, so a
-- browser holding the anon key or a staff session cannot read or write the
-- tables around the API.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sites admin all" ON public.sites;
CREATE POLICY "Sites admin all"
ON public.sites FOR ALL TO authenticated
USING (public.is_admin_like())
WITH CHECK (public.is_admin_like());

DROP POLICY IF EXISTS "Site documents admin all" ON public.site_documents;
CREATE POLICY "Site documents admin all"
ON public.site_documents FOR ALL TO authenticated
USING (public.is_admin_like())
WITH CHECK (public.is_admin_like());

REVOKE ALL ON public.sites FROM anon;
REVOKE ALL ON public.site_documents FROM anon;

NOTIFY pgrst, 'reload schema';
