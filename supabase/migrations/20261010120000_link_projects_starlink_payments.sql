-- Link mini-grid projects -> Starlink kits -> payments, so a project shows its
-- Starlink subscription and every invoice/receipt paid for it.
--
--   projects.website_slug         ties a project to its page on acoblighting.com
--   starlink_sites.project_id     the project a Starlink kit serves
--   starlink_sites.kit_number     KIT... printed on every Starlink invoice
--   department_payments.project_id  any payment can be charged to a project
--
-- starlink_sites.serial_number already holds the Starlink customer account
-- (ACC-...), which is what emailed invoices are matched on.

-- 1. Schema ------------------------------------------------------------------

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS website_slug TEXT;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_website_slug_key;
ALTER TABLE public.projects ADD CONSTRAINT projects_website_slug_key UNIQUE (website_slug);
COMMENT ON COLUMN public.projects.website_slug IS
  'Slug of this project on acoblighting.com/projects (Sanity project document).';

ALTER TABLE public.starlink_sites
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.starlink_sites ADD COLUMN IF NOT EXISTS kit_number TEXT;
ALTER TABLE public.starlink_sites DROP CONSTRAINT IF EXISTS starlink_sites_kit_number_key;
ALTER TABLE public.starlink_sites ADD CONSTRAINT starlink_sites_kit_number_key UNIQUE (kit_number);
-- Not every kit's login email or phone is on record yet.
ALTER TABLE public.starlink_sites ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.starlink_sites ALTER COLUMN phone_number DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_starlink_sites_project ON public.starlink_sites(project_id);
COMMENT ON COLUMN public.starlink_sites.serial_number IS
  'Starlink customer account number (ACC-...), as printed on every Starlink invoice.';
COMMENT ON COLUMN public.starlink_sites.kit_number IS
  'Starlink kit number (KIT...), as printed under Service Lines on every Starlink invoice.';

ALTER TABLE public.department_payments
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dept_payments_project ON public.department_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_dept_payments_site ON public.department_payments(site_id);

-- 2. RLS: starlink_sites was writable by any staff member ------------------------
-- The app reads it through server routes with the service-role client; this is
-- the backstop for the public REST path.

DROP POLICY IF EXISTS "Starlink sites management" ON public.starlink_sites;
DROP POLICY IF EXISTS "Starlink sites admin access" ON public.starlink_sites;
CREATE POLICY "Starlink sites admin access" ON public.starlink_sites
  FOR ALL TO authenticated
  USING (public.is_admin_like())
  WITH CHECK (public.is_admin_like());

-- 3. Data: completed mini-grids from acoblighting.com ---------------------------
-- Dates are the website listing date; deployment dates were never recorded.

INSERT INTO public.projects (
  website_slug, project_name, location, capacity_w,
  deployment_start_date, deployment_end_date, completed_at,
  technology_type, status, priority, description
)
SELECT
  v.slug, v.name, v.location, v.capacity_w,
  v.listed::date, v.listed::date, v.listed::timestamptz,
  'Hybrid Solar Mini-Grid', 'completed', 'medium',
  v.title || E'\n\nImported from acoblighting.com/projects/' || v.slug
    || '. Dates are the website listing date, not confirmed deployment dates.'
FROM (VALUES
  ('adebayo-100kwp-hybrid-solar-minigrid-electrification', '100kWp HYBRID SOLAR MINI-GRID - ADEBAYO', 'Adebayo, Ovia South-West LGA, Edo State', 100000, '2025-09-08', 'Adebayo 100 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Edo State, Nigeria'),
  ('ajegunle-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state', '40kWp HYBRID SOLAR MINI-GRID - AJEGUNLE', 'Ajegunle, Ovia South-West LGA, Edo State', 40000, '2025-12-28', 'Ajegunle Community 40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Edo State, Nigeria'),
  ('ayetoro-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state', '40kWp HYBRID SOLAR MINI-GRID - AYETORO', 'Ayetoro, Ovia South-West LGA, Edo State', 40000, '2025-12-28', 'Ayetoro Community 40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Edo State, Nigeria'),
  ('oloyan-community-100-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state', '100kWp HYBRID SOLAR MINI-GRID - OLOYAN', 'Oloyan, Ovia South-West LGA, Edo State', 100000, '2025-12-29', 'Oloyan Community 100 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Edo State, Nigeria'),
  ('sule-aba-panu-community-60-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo', '60kWp HYBRID SOLAR MINI-GRID - SULE ABA-PANU', 'Sule Aba-panu, Ovia South-West LGA, Edo State', 60000, '2025-12-29', 'Sule Aba-panu Community 60 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Edo State, Nigeria'),
  ('50-kwp-solar-hybrid-mini-grid-at-makami-community', '50kWp HYBRID SOLAR MINI-GRID - MAKAMI', 'Makami, Kauru LGA, Kaduna State', 50000, '2024-09-15', 'Makami 50 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Kaduna State, Nigeria'),
  ('kyakale-150-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria', '150kWp HYBRID SOLAR MINI-GRID - KYAKALE', 'Kyakale, Obi LGA, Nasarawa State', 150000, '2025-10-10', 'Kyakale 150 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Nasarawa State, Nigeria'),
  ('musha-150-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria', '150kWp HYBRID SOLAR MINI-GRID - MUSHA', 'Musha, Obi LGA, Nasarawa State', 150000, '2025-11-20', 'Musha 150 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Nasarawa State, Nigeria'),
  ('ogufa-200-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria', '200kWp HYBRID SOLAR MINI-GRID - OGUFA', 'Ogufa, Nasarawa LGA, Nasarawa State', 200000, '2025-10-20', 'Ogufa 200 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Nasarawa State, Nigeria'),
  ('tunga-300-kwp-hybrid-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria', '300kWp HYBRID SOLAR MINI-GRID - TUNGA', 'Tunga, Awe LGA, Nasarawa State', 300000, '2025-10-06', 'Tunga 300 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Nasarawa State, Nigeria'),
  ('umaisha-community-350-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa', '350kWp HYBRID SOLAR MINI-GRID - UMAISHA', 'Umaisha, Toto LGA, Nasarawa State', 350000, '2025-11-20', 'Umaisha Community 350 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Nasarawa State, Nigeria'),
  ('olooji-community-100-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ogun-state', '100kWp HYBRID SOLAR MINI-GRID - OLOOJI', 'Olooji, Ijebu East LGA, Ogun State', 100000, '2024-09-19', 'Olooji Community 100 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ogun State, Nigeria'),
  ('asejire-community-70-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state', '70kWp HYBRID SOLAR MINI-GRID - ASEJIRE', 'Asejire, Odigbo LGA, Ondo State', 70000, '2025-12-28', 'Asejire Community 70 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'),
  ('bolorunduro-adaja-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo', '40kWp HYBRID SOLAR MINI-GRID - BOLORUNDURO ADAJA', 'Bolorunduro Adaja, Odigbo LGA, Ondo State', 40000, '2025-12-28', 'Bolorunduro Adaja Community 40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'),
  ('bolorunduro-adewole-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification', '40kWp HYBRID SOLAR MINI-GRID - BOLORUNDURO ADEWOLE', 'Bolorunduro Adewole, Odigbo LGA, Ondo State', 40000, '2025-12-28', 'Bolorunduro Adewole Community 40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'),
  ('mile-13-community-60-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state', '60kWp HYBRID SOLAR MINI-GRID - MILE 13 COMMUNITY', 'Mile 13 Community, Odigbo LGA, Ondo State', 60000, '2025-12-20', 'Mile 13 Community 60 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'),
  ('mile-9-community-50-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state', '50kWp HYBRID SOLAR MINI-GRID - MILE 9', 'Mile 9, Odigbo LGA, Ondo State', 50000, '2025-12-29', 'Mile 9 Community 50 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'),
  ('obadore-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state', '40kWp HYBRID SOLAR MINI-GRID - OBADORE', 'Obadore, Odigbo LGA, Ondo State', 40000, '2024-09-15', 'Obadore Community 40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'),
  ('orotedo-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state', '40kWp HYBRID SOLAR MINI-GRID - OROTEDO', 'Orotedo, Odigbo LGA, Ondo State', 40000, '2025-12-29', 'Orotedo Community 40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'),
  ('otu-costain-community-70-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state', '70kWp HYBRID SOLAR MINI-GRID - OTU-COSTAIN', 'Otu-Costain, Odigbo LGA, Ondo State', 70000, '2025-12-29', 'Otu-Costain Community 70 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria')

) AS v(slug, name, location, capacity_w, listed, title)
ON CONFLICT (website_slug) DO NOTHING;

-- 4. Data: Starlink kits, with account/kit numbers read off their invoices ------

INSERT INTO public.starlink_sites (state, site_name, serial_number, kit_number, is_active, notes)
VALUES
  ('Edo', 'Adebayo', 'ACC-3038459-10152-6', 'KIT301967947', TRUE, 'Login email not on record yet.'),
  ('Nasarawa', 'Tunga', 'ACC-DF-10027839-61596-53', 'KIT402689127CDF', TRUE, 'Login email not on record yet.')
ON CONFLICT (serial_number) DO NOTHING;

UPDATE public.starlink_sites s
SET kit_number = k.kit_number,
    project_id = p.id,
    updated_at = now()
FROM (VALUES
  ('ACC-DF-10220671-51752-35', 'KIT4026823492SX', 'ajegunle-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state'),
  ('ACC-DF-10224272-87960-46', 'KIT402327497XRS', 'oloyan-community-100-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state'),
  ('ACC-3038459-10152-6', 'KIT301967947', 'adebayo-100kwp-hybrid-solar-minigrid-electrification'),
  ('ACC-DF-10039348-86576-56', 'KIT402680723FVF', 'kyakale-150-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria'),
  ('ACC-DF-10031475-12083-31', 'KIT402330186BCC', 'musha-150-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria'),
  ('ACC-DF-10041149-48436-41', 'KIT402324676VXR', 'ogufa-200-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria'),
  ('ACC-DF-10027839-61596-53', 'KIT402689127CDF', 'tunga-300-kwp-hybrid-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria'),
  ('ACC-DF-10043992-60105-36', 'KIT402682770GXS', 'umaisha-community-350-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa')
) AS k(account, kit_number, slug)
JOIN public.projects p ON p.website_slug = k.slug
WHERE s.serial_number = k.account;

-- 5. Data: point the existing Starlink payments at their kit and project --------
-- Matched on the payment title, which is the kit's site name. "Office" is the
-- head-office line paid through a reseller, so it has no kit or project.

UPDATE public.department_payments d
SET site_id = s.id,
    project_id = s.project_id,
    updated_at = now()
FROM public.starlink_sites s
WHERE d.category = 'Starlink'
  AND d.site_id IS NULL
  AND lower(trim(d.title)) = lower(trim(s.site_name));
