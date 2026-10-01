-- Corporate KPIs belong to a strategic plan year. The 61 imported KPIs are the
-- 2026 plan; 2027's are loaded as new rows rather than edited over these, so
-- 2026 attainment, actuals and the tasks tagged to it stay intact as history.
--
-- source_sn is the S/N inside one year's workbook, so it is unique per year,
-- not globally.

ALTER TABLE public.corporate_kpis
  ADD COLUMN IF NOT EXISTS plan_year integer NOT NULL DEFAULT 2026;

-- New rows default to the current year (WAT) unless the caller says otherwise.
ALTER TABLE public.corporate_kpis
  ALTER COLUMN plan_year SET DEFAULT (extract(year from (now() AT TIME ZONE 'Africa/Lagos')))::integer;

ALTER TABLE public.corporate_kpis DROP CONSTRAINT IF EXISTS corporate_kpis_source_sn_key;
ALTER TABLE public.corporate_kpis DROP CONSTRAINT IF EXISTS corporate_kpis_plan_year_source_sn_key;
ALTER TABLE public.corporate_kpis
  ADD CONSTRAINT corporate_kpis_plan_year_source_sn_key UNIQUE (plan_year, source_sn);

COMMENT ON COLUMN public.corporate_kpis.plan_year IS
  'Strategic plan year this KPI belongs to. Scorecard pages show one year at a time; pacing runs over this year.';
COMMENT ON COLUMN public.corporate_kpis.source_sn IS
  'S/N from that year''s Corporate Scorecard Master sheet; unique within plan_year.';

NOTIFY pgrst, 'reload schema';
