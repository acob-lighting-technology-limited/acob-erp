ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES public.weekly_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_weekly_action_report_id
ON public.tasks (report_id)
WHERE category = 'weekly_action';

UPDATE public.tasks AS t
SET report_id = wr.id,
    source_id = COALESCE(t.source_id, wr.id)
FROM public.weekly_reports AS wr
WHERE t.category = 'weekly_action'
  AND t.report_id IS NULL
  AND t.department = wr.department
  AND t.week_number = wr.week_number
  AND t.year = wr.year;

CREATE OR REPLACE FUNCTION public.sync_weekly_report_tasks(p_report_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public.weekly_reports%ROWTYPE;
  v_has_active_tasks BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_report
  FROM public.weekly_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.tasks
  SET report_id = v_report.id,
      source_id = COALESCE(source_id, v_report.id),
      assigned_by = COALESCE(assigned_by, v_report.user_id),
      updated_at = NOW()
  WHERE category = 'weekly_action'
    AND report_id IS NULL
    AND department = v_report.department
    AND week_number = v_report.week_number
    AND year = v_report.year;

  UPDATE public.tasks
  SET department = v_report.department,
      week_number = v_report.week_number,
      year = v_report.year,
      assigned_by = COALESCE(assigned_by, v_report.user_id),
      source_id = COALESCE(source_id, v_report.id),
      updated_at = NOW()
  WHERE category = 'weekly_action'
    AND report_id = v_report.id;

  IF COALESCE(v_report.status, 'submitted') <> 'submitted' THEN
    DELETE FROM public.tasks
    WHERE category = 'weekly_action'
      AND report_id = v_report.id
      AND status = 'pending';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE category = 'weekly_action'
      AND report_id = v_report.id
      AND status <> 'pending'
  )
  INTO v_has_active_tasks;

  IF v_has_active_tasks THEN
    RETURN;
  END IF;

  DELETE FROM public.tasks
  WHERE category = 'weekly_action'
    AND report_id = v_report.id
    AND status = 'pending';

  INSERT INTO public.tasks (
    title,
    department,
    status,
    week_number,
    year,
    assigned_by,
    source_type,
    source_id,
    category,
    assignment_type,
    priority,
    report_id
  )
  SELECT cleaned.title,
         v_report.department,
         'pending',
         v_report.week_number,
         v_report.year,
         v_report.user_id,
         'action_item',
         v_report.id,
         'weekly_action',
         'department',
         'medium',
         v_report.id
  FROM regexp_split_to_table(COALESCE(v_report.tasks_new_week, ''), E'\\r?\\n') WITH ORDINALITY AS lines(raw_line, line_no)
  CROSS JOIN LATERAL (
    SELECT NULLIF(
      BTRIM(
        regexp_replace(lines.raw_line, '^\s*(?:\d+[.)]\s*|[-*]\s*)', '')
      ),
      ''
    ) AS title
  ) AS cleaned
  WHERE cleaned.title IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_weekly_report_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.tasks
    WHERE category = 'weekly_action'
      AND report_id = OLD.id
      AND status = 'pending';
    RETURN OLD;
  END IF;

  PERFORM public.sync_weekly_report_tasks(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_weekly_report_tasks ON public.weekly_reports;
CREATE TRIGGER tr_sync_weekly_report_tasks
AFTER INSERT OR UPDATE OF department, week_number, year, tasks_new_week, status, user_id
ON public.weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_weekly_report_tasks();

DO $$
DECLARE
  report_record RECORD;
BEGIN
  FOR report_record IN
    SELECT id
    FROM public.weekly_reports
    WHERE status = 'submitted'
  LOOP
    PERFORM public.sync_weekly_report_tasks(report_record.id);
  END LOOP;
END;
$$;
