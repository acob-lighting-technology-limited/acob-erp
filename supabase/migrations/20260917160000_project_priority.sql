-- Migration: Project priority
-- Timestamp: 20260917160000
--
-- A priority a manager sets by hand (Critical / High / Medium / Low), separate
-- from the calculated progress status and from the lifecycle stage. The
-- projects list sorts by it by default, and the Overview uses it to order
-- projects that share the same progress status.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_priority_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_priority_check CHECK (priority IN ('critical', 'high', 'medium', 'low'));

COMMENT ON COLUMN public.projects.priority IS
  'Set by hand: critical, high, medium or low. Independent of the calculated progress status.';
