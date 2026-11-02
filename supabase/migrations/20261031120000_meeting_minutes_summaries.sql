-- Summary of minutes, one per meeting week.
--
-- Reports admins paste a short (≈2 page) summary of a meeting's minutes on the
-- General Meeting → Minutes page. The next meeting's agenda deck shows it as
-- text slides under "Minutes of the Last Meeting", falling back to the full
-- minutes PDF (meeting_week_documents, document_type = 'minutes') when a week
-- has no summary. Summaries are never part of the meeting mail.
--
-- content_html is the editor's output: rich text limited to paragraphs,
-- headings, lists, bold and italic. It is sanitised with DOMPurify wherever it
-- is rendered.
--
-- Access: every signed-in staff member may read (the same as full minutes,
-- see meeting_week_documents_select_staff_readable). All writes go through
-- /api/reports/meeting-minutes-summaries with the service-role client, which
-- checks reports write access and the week lock; authenticated has no write
-- grant at all, so the browser cannot write around that route.

BEGIN;

CREATE TABLE IF NOT EXISTS public.meeting_minutes_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_week integer NOT NULL,
  meeting_year integer NOT NULL,
  content_html text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_minutes_summaries_week_check CHECK (meeting_week BETWEEN 1 AND 53),
  CONSTRAINT meeting_minutes_summaries_year_check CHECK (meeting_year BETWEEN 2000 AND 2100),
  -- Two pages of text is well under this; it stops a runaway paste.
  CONSTRAINT meeting_minutes_summaries_content_check CHECK (char_length(content_html) BETWEEN 1 AND 200000),
  CONSTRAINT meeting_minutes_summaries_week_unique UNIQUE (meeting_year, meeting_week)
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_summaries_created_by
  ON public.meeting_minutes_summaries (created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_summaries_updated_by
  ON public.meeting_minutes_summaries (updated_by);

ALTER TABLE public.meeting_minutes_summaries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meeting_minutes_summaries FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.meeting_minutes_summaries FROM authenticated;
GRANT SELECT ON public.meeting_minutes_summaries TO authenticated;
GRANT ALL ON public.meeting_minutes_summaries TO service_role;

DROP POLICY IF EXISTS meeting_minutes_summaries_select ON public.meeting_minutes_summaries;
CREATE POLICY meeting_minutes_summaries_select
ON public.meeting_minutes_summaries
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

COMMIT;
