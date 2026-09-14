-- ─────────────────────────────────────────────────────────────
-- Migration: Group seeded & unassigned project tasks into EPC plans
--
-- Ensures all existing project tasks belong to appropriate Implementation Plans,
-- preserving all historical weights, statuses, assignees, and appraisal ratings.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  r_proj RECORD;
  v_plan_civil_id uuid;
  v_plan_pv_id uuid;
  v_plan_dist_id uuid;
  v_plan_meter_id uuid;
  v_plan_gov_id uuid;
BEGIN
  -- Iterate through each project that has tasks without a plan
  FOR r_proj IN 
    SELECT DISTINCT project_id 
    FROM public.tasks 
    WHERE project_id IS NOT NULL 
      AND plan_id IS NULL
  LOOP
    -- 1. Site & Civil Works
    SELECT id INTO v_plan_civil_id 
    FROM public.implementation_plans 
    WHERE project_id = r_proj.project_id AND name = 'Site & Civil Works' LIMIT 1;

    IF v_plan_civil_id IS NULL THEN
      INSERT INTO public.implementation_plans (project_id, name, description, sort_order)
      VALUES (r_proj.project_id, 'Site & Civil Works', 'Perimeter fencing, pole planting, moulding, and civil foundations.', 10)
      RETURNING id INTO v_plan_civil_id;
    END IF;

    -- 2. Solar PV Generation & Mounting
    SELECT id INTO v_plan_pv_id 
    FROM public.implementation_plans 
    WHERE project_id = r_proj.project_id AND name = 'Solar PV Generation & Mounting' LIMIT 1;

    IF v_plan_pv_id IS NULL THEN
      INSERT INTO public.implementation_plans (project_id, name, description, sort_order)
      VALUES (r_proj.project_id, 'Solar PV Generation & Mounting', 'PV array structure, solar modules, inverters, battery storage, and system installation.', 20)
      RETURNING id INTO v_plan_pv_id;
    END IF;

    -- 3. Distribution Network & Logistics
    SELECT id INTO v_plan_dist_id 
    FROM public.implementation_plans 
    WHERE project_id = r_proj.project_id AND name = 'Distribution Network & Logistics' LIMIT 1;

    IF v_plan_dist_id IS NULL THEN
      INSERT INTO public.implementation_plans (project_id, name, description, sort_order)
      VALUES (r_proj.project_id, 'Distribution Network & Logistics', 'Distribution stringing, transformers, accessories delivery, and subcontractor execution.', 30)
      RETURNING id INTO v_plan_dist_id;
    END IF;

    -- 4. Customer DropDown & Metering
    SELECT id INTO v_plan_meter_id 
    FROM public.implementation_plans 
    WHERE project_id = r_proj.project_id AND name = 'Customer DropDown & Metering' LIMIT 1;

    IF v_plan_meter_id IS NULL THEN
      INSERT INTO public.implementation_plans (project_id, name, description, sort_order)
      VALUES (r_proj.project_id, 'Customer DropDown & Metering', 'Customer drop-down lines, service connections, and smart energy meters.', 40)
      RETURNING id INTO v_plan_meter_id;
    END IF;

    -- 5. Project Governance & Reporting
    SELECT id INTO v_plan_gov_id 
    FROM public.implementation_plans 
    WHERE project_id = r_proj.project_id AND name = 'Project Governance & Reporting' LIMIT 1;

    IF v_plan_gov_id IS NULL THEN
      INSERT INTO public.implementation_plans (project_id, name, description, sort_order)
      VALUES (r_proj.project_id, 'Project Governance & Reporting', 'Regulatory compliance, milestone reports, stakeholder engagements, and close-out activities.', 50)
      RETURNING id INTO v_plan_gov_id;
    END IF;

    -- ── Map tasks to plans based on title ──

    -- Customer DropDown & Metering
    UPDATE public.tasks
    SET plan_id = v_plan_meter_id
    WHERE project_id = r_proj.project_id
      AND plan_id IS NULL
      AND (
        lower(title) LIKE '%dropdown%' 
        OR lower(title) LIKE '%metering%'
        OR lower(title) LIKE '%smart meter%'
      );

    -- Site & Civil Works
    UPDATE public.tasks
    SET plan_id = v_plan_civil_id
    WHERE project_id = r_proj.project_id
      AND plan_id IS NULL
      AND (
        lower(title) LIKE '%fence%'
        OR lower(title) LIKE '%fencing%'
        OR lower(title) LIKE '%pole planting%'
        OR lower(title) LIKE '%pole moulding%'
        OR lower(title) LIKE '%pole distribution%'
        OR lower(title) LIKE '%civil%'
      );

    -- Solar PV Generation & Mounting
    UPDATE public.tasks
    SET plan_id = v_plan_pv_id
    WHERE project_id = r_proj.project_id
      AND plan_id IS NULL
      AND (
        lower(title) LIKE '%pv array%'
        OR lower(title) LIKE '%mounting structure%'
        OR lower(title) LIKE '%pv module%'
        OR lower(title) LIKE '%generation asset%'
        OR lower(title) LIKE '%system installation%'
        OR lower(title) LIKE '%inverter%'
        OR lower(title) LIKE '%battery%'
      );

    -- Project Governance & Reporting
    UPDATE public.tasks
    SET plan_id = v_plan_gov_id
    WHERE project_id = r_proj.project_id
      AND plan_id IS NULL
      AND (
        lower(title) LIKE '%report%'
        OR lower(title) LIKE '%qamf%'
        OR lower(title) LIKE '%template%'
        OR lower(title) LIKE '%tpa close out%'
        OR lower(title) LIKE '%rmi engagement%'
      );

    -- Distribution Network & Logistics (and remaining)
    UPDATE public.tasks
    SET plan_id = v_plan_dist_id
    WHERE project_id = r_proj.project_id
      AND plan_id IS NULL;

  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
