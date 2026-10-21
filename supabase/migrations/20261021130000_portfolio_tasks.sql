-- ─────────────────────────────────────────────────────────────
-- Portfolio-level tasks
--
-- tasks.portfolio_id lets a task be assigned against a whole portfolio (work
-- across a group of sites in the development phase) rather than one project.
-- A task is either project work or portfolio work, never both: a project task
-- already belongs to its project's portfolio, and storing it twice would let
-- the two disagree when a project moves portfolio.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_portfolio_id ON public.tasks (portfolio_id) WHERE portfolio_id IS NOT NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_project_or_portfolio_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_project_or_portfolio_check
  CHECK (portfolio_id IS NULL OR project_id IS NULL);

COMMENT ON COLUMN public.tasks.portfolio_id IS
  'Portfolio-wide work not tied to one project. Mutually exclusive with project_id; rated by the normal department rule.';

NOTIFY pgrst, 'reload schema';
