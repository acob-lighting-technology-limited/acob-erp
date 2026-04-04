-- ============================================================
-- Add department_id FK to assets, meeting_week_documents,
-- and weekly_reports tables, with backfill from existing
-- department text values using known aliases.
-- ============================================================

-- Helper: normalise legacy department name strings to the
-- canonical name stored in the departments table.
CREATE OR REPLACE FUNCTION _tmp_normalize_dept(raw text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(trim(raw)) = 'operations'                       THEN 'Operations and Maintenance'
    WHEN lower(trim(raw)) = 'legal, regulatory and compliance' THEN 'Regulatory and Compliance'
    WHEN lower(trim(raw)) = 'regulatory and compliance'        THEN 'Regulatory and Compliance'
    WHEN lower(trim(raw)) = 'finance'                          THEN 'Accounts'
    ELSE trim(raw)
  END
$$;

-- ────────────────────────────────────────────────────────────
-- 1. assets
-- ────────────────────────────────────────────────────────────
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

UPDATE assets a
SET department_id = d.id
FROM departments d
WHERE d.name = _tmp_normalize_dept(a.department)
  AND a.department IS NOT NULL
  AND a.department_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_assets_department_id
  ON assets (department_id);

-- ────────────────────────────────────────────────────────────
-- 2. meeting_week_documents
-- ────────────────────────────────────────────────────────────
ALTER TABLE meeting_week_documents
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

UPDATE meeting_week_documents m
SET department_id = d.id
FROM departments d
WHERE d.name = _tmp_normalize_dept(m.department)
  AND m.department IS NOT NULL
  AND m.department_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_week_documents_department_id
  ON meeting_week_documents (department_id);

-- ────────────────────────────────────────────────────────────
-- 3. weekly_reports
-- ────────────────────────────────────────────────────────────
ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

UPDATE weekly_reports r
SET department_id = d.id
FROM departments d
WHERE d.name = _tmp_normalize_dept(r.department)
  AND r.department IS NOT NULL
  AND r.department_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_reports_department_id
  ON weekly_reports (department_id);

-- ────────────────────────────────────────────────────────────
-- Clean up temp helper
-- ────────────────────────────────────────────────────────────
DROP FUNCTION _tmp_normalize_dept(text);
