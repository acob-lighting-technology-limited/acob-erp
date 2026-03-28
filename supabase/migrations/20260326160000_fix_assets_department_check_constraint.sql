-- Fix: Replace hardcoded assets_department_check with the full current department list.
-- The old constraint was missing: Corporate Services, Executive Management,
-- Monitoring and Evaluation, and Project — all of which now exist in the departments table.

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_department_check;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_department_check CHECK (
    department IS NULL OR department = ANY (ARRAY[
      'Accounts',
      'Admin & HR',
      'Business, Growth and Innovation',
      'Corporate Services',
      'Executive Management',
      'IT and Communications',
      'Legal, Regulatory and Compliance',
      'Logistics',
      'Monitoring and Evaluation',
      'Operations',
      'Project',
      'Technical'
    ])
  );
