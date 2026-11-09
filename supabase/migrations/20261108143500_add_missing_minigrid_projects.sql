-- Seed the 3 mini-grid projects identified from operational records:
-- Onipanu (operational, Ondo), Erinla (under construction, Ondo), Bondu (under construction, Edo).

INSERT INTO public.projects (
  project_name,
  location,
  capacity_w,
  deployment_start_date,
  deployment_end_date,
  technology_type,
  status,
  priority,
  description
)
SELECT
  v.name, v.location, v.capacity_w,
  v.start_date::date, v.end_date::date,
  'Hybrid Solar Mini-Grid', 'active', 'medium',
  v.description
FROM (VALUES
  (
    '100kWp HYBRID SOLAR MINI-GRID - ONIPANU',
    'Onipanu, Odigbo LGA, Ondo State',
    100000,
    '2024-01-01',
    '2024-12-31',
    '100 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'
  ),
  (
    '40kWp HYBRID SOLAR MINI-GRID - ERINLA',
    'Erinla, Odigbo LGA, Ondo State',
    40000,
    '2025-01-01',
    '2025-12-31',
    '40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Ondo State, Nigeria'
  ),
  (
    '40kWp HYBRID SOLAR MINI-GRID - BONDU',
    'Bondu, Ovia South-West LGA, Edo State',
    40000,
    '2025-01-01',
    '2025-12-31',
    '40 kWp Hybrid Solar Mini-Grid Project for Rural Electrification, Edo State, Nigeria'
  )
) AS v(name, location, capacity_w, start_date, end_date, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p WHERE p.project_name = v.name
);
