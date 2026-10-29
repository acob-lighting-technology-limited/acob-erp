-- Set the 20 mini-grid projects imported from acoblighting.com to 'active'
-- so operational and maintenance tasks can be linked to them.

UPDATE public.projects
SET status = 'active',
    updated_at = now()
WHERE website_slug IN (
  'adebayo-100kwp-hybrid-solar-minigrid-electrification',
  'ajegunle-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state',
  'ayetoro-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state',
  'oloyan-community-100-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo-state',
  'sule-aba-panu-community-60-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-edo',
  '50-kwp-solar-hybrid-mini-grid-at-makami-community',
  'kyakale-150-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria',
  'musha-150-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria',
  'ogufa-200-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria',
  'tunga-300-kwp-hybrid-mini-grid-project-for-rural-electrification-nasarawa-state-nigeria',
  'umaisha-community-350-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-nasarawa',
  'olooji-community-100-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ogun-state',
  'asejire-community-70-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state',
  'bolorunduro-adaja-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo',
  'bolorunduro-adewole-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification',
  'mile-13-community-60-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state',
  'mile-9-community-50-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state',
  'obadore-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state',
  'orotedo-community-40-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state',
  'otu-costain-community-70-kwp-hybrid-solar-mini-grid-project-for-rural-electrification-ondo-state'
);
