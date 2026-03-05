-- Leave Flow Builder v2 (data-driven, admin-editable)

-- Approver role catalog
CREATE TABLE IF NOT EXISTS public.leave_approver_roles (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  resolution_mode text NOT NULL DEFAULT 'department_lead'
    CHECK (resolution_mode IN ('fixed_user', 'department_lead', 'rule_based')),
  resolution_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Route rows (requester_kind + ordered stages)
CREATE TABLE IF NOT EXISTS public.leave_approval_role_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_kind text NOT NULL
    CHECK (requester_kind IN ('employee', 'dept_lead', 'admin_hr_lead', 'hcs', 'md')),
  stage_order integer NOT NULL CHECK (stage_order > 0),
  approver_role_code text NOT NULL REFERENCES public.leave_approver_roles(code),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_kind, stage_order)
);

-- Optional fixed assignments for future/custom roles
CREATE TABLE IF NOT EXISTS public.leave_approver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approver_role_code text NOT NULL REFERENCES public.leave_approver_roles(code),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope_type text NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'department', 'office')),
  scope_value text,
  effective_from timestamptz,
  effective_to timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_approver_assignments_primary_scope
  ON public.leave_approver_assignments(approver_role_code, scope_type, COALESCE(scope_value, ''))
  WHERE is_active = true AND is_primary = true;

-- Runtime fields on leave requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS requester_route_kind text,
  ADD COLUMN IF NOT EXISTS route_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_stage_order integer,
  ADD COLUMN IF NOT EXISTS current_approver_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS current_stage_code text,
  ADD COLUMN IF NOT EXISTS reliever_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lead_reconfirm_required boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_requester_route_kind_check'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_requester_route_kind_check
      CHECK (
        requester_route_kind IS NULL OR requester_route_kind IN ('employee', 'dept_lead', 'admin_hr_lead', 'hcs', 'md')
      );
  END IF;
END $$;

-- Runtime fields on approval history
ALTER TABLE public.leave_approvals
  ADD COLUMN IF NOT EXISTS stage_code text,
  ADD COLUMN IF NOT EXISTS stage_order integer,
  ADD COLUMN IF NOT EXISTS superseded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reliever_revision integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_leave_requests_current_approver ON public.leave_requests(current_approver_user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_stage_code ON public.leave_requests(current_stage_code);

-- Seed roles
INSERT INTO public.leave_approver_roles (code, name, description, resolution_mode, resolution_config)
VALUES
  ('reliever', 'Reliever', 'Reliever selected by requester', 'rule_based', '{"source":"request_reliever"}'::jsonb),
  ('department_lead', 'Department Lead', 'Lead of requester department', 'department_lead', '{"source":"requester_department"}'::jsonb),
  ('admin_hr_lead', 'Admin & HR Lead', 'Lead of Admin & HR department', 'department_lead', '{"department":"Admin & HR"}'::jsonb),
  ('md', 'Managing Director', 'Lead of Executive Management department', 'department_lead', '{"department":"Executive Management"}'::jsonb),
  ('hcs', 'Head Corporate Services', 'Lead of Corporate Services department', 'department_lead', '{"department":"Corporate Services"}'::jsonb)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  resolution_mode = EXCLUDED.resolution_mode,
  resolution_config = EXCLUDED.resolution_config,
  is_active = true,
  updated_at = now();

-- Seed default editable routes
INSERT INTO public.leave_approval_role_routes (requester_kind, stage_order, approver_role_code, is_active)
VALUES
  ('employee', 1, 'reliever', true),
  ('employee', 2, 'department_lead', true),
  ('employee', 3, 'admin_hr_lead', true),

  ('dept_lead', 1, 'reliever', true),
  ('dept_lead', 2, 'md', true),
  ('dept_lead', 3, 'admin_hr_lead', true),

  ('admin_hr_lead', 1, 'reliever', true),
  ('admin_hr_lead', 2, 'md', true),
  ('admin_hr_lead', 3, 'hcs', true),

  ('hcs', 1, 'reliever', true),
  ('hcs', 2, 'md', true),
  ('hcs', 3, 'admin_hr_lead', true),

  ('md', 1, 'reliever', true),
  ('md', 2, 'admin_hr_lead', true)
ON CONFLICT (requester_kind, stage_order) DO UPDATE
SET approver_role_code = EXCLUDED.approver_role_code,
    is_active = true,
    updated_at = now();

-- Health view
CREATE OR REPLACE VIEW public.leave_routing_health_v AS
WITH dept_leads AS (
  SELECT
    count(*) FILTER (
      WHERE is_department_lead = true
        AND (
          department = 'Admin & HR'
          OR ('Admin & HR' = ANY(COALESCE(lead_departments, ARRAY[]::text[])))
        )
    ) AS admin_hr_lead_count,
    count(*) FILTER (
      WHERE is_department_lead = true
        AND (
          department = 'Executive Management'
          OR ('Executive Management' = ANY(COALESCE(lead_departments, ARRAY[]::text[])))
        )
    ) AS md_count,
    count(*) FILTER (
      WHERE is_department_lead = true
        AND (
          department = 'Corporate Services'
          OR ('Corporate Services' = ANY(COALESCE(lead_departments, ARRAY[]::text[])))
        )
    ) AS hcs_count
  FROM public.profiles
), route_counts AS (
  SELECT requester_kind, count(*) FILTER (WHERE is_active = true) AS active_stage_count
  FROM public.leave_approval_role_routes
  GROUP BY requester_kind
)
SELECT
  d.admin_hr_lead_count,
  d.md_count,
  d.hcs_count,
  COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'employee'), 0) AS employee_stage_count,
  COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'dept_lead'), 0) AS dept_lead_stage_count,
  COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'admin_hr_lead'), 0) AS admin_hr_lead_stage_count,
  COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'hcs'), 0) AS hcs_stage_count,
  COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'md'), 0) AS md_stage_count,
  (
    d.admin_hr_lead_count > 0
    AND d.md_count > 0
    AND d.hcs_count > 0
    AND COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'employee'), 0) > 0
    AND COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'dept_lead'), 0) > 0
    AND COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'admin_hr_lead'), 0) > 0
    AND COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'hcs'), 0) > 0
    AND COALESCE((SELECT active_stage_count FROM route_counts WHERE requester_kind = 'md'), 0) > 0
  ) AS is_configured
FROM dept_leads d;

-- RLS
ALTER TABLE public.leave_approver_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_approval_role_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_approver_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leave approver roles select" ON public.leave_approver_roles;
CREATE POLICY "Leave approver roles select" ON public.leave_approver_roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Leave approver roles manage" ON public.leave_approver_roles;
CREATE POLICY "Leave approver roles manage" ON public.leave_approver_roles
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "Leave role routes select" ON public.leave_approval_role_routes;
CREATE POLICY "Leave role routes select" ON public.leave_approval_role_routes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Leave role routes manage" ON public.leave_approval_role_routes;
CREATE POLICY "Leave role routes manage" ON public.leave_approval_role_routes
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "Leave approver assignments select" ON public.leave_approver_assignments;
CREATE POLICY "Leave approver assignments select" ON public.leave_approver_assignments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Leave approver assignments manage" ON public.leave_approver_assignments;
CREATE POLICY "Leave approver assignments manage" ON public.leave_approver_assignments
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));
