-- Two 2026 KPIs were imported with the wrong measure type, which changes how
-- attainment is worked out. Neither had any recorded actuals when corrected.
--
--   #17 "Revenue generated" — ₦27.2 billion target, stored as a count.
--        Now currency; targets and actuals are in ₦ billions (27.2 = ₦27.2bn).
--   #20 "% decrease in operational cost" — stored as a count. Now a
--        percentage; departments still have to set their own target.

UPDATE public.corporate_kpis
   SET measure_type = 'currency', updated_at = now()
 WHERE plan_year = 2026 AND source_sn = 17 AND measure_type <> 'currency';

UPDATE public.kpi_assignments a
   SET target_unit = '₦ billion', updated_at = now()
  FROM public.corporate_kpis k
 WHERE a.kpi_id = k.id AND k.plan_year = 2026 AND k.source_sn = 17
   AND a.target_unit IS NULL;

UPDATE public.corporate_kpis
   SET measure_type = 'percentage', updated_at = now()
 WHERE plan_year = 2026 AND source_sn = 20 AND measure_type <> 'percentage';

UPDATE public.kpi_assignments a
   SET target_unit = '%', updated_at = now()
  FROM public.corporate_kpis k
 WHERE a.kpi_id = k.id AND k.plan_year = 2026 AND k.source_sn = 20
   AND a.target_unit IS NULL;
