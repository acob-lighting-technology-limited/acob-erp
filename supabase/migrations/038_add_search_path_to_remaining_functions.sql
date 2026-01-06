-- Final Security Hardening - Fix All Remaining Issues
-- 1. Add search_path to all remaining functions
-- 2. Recreate views without SECURITY DEFINER

-- =====================================================
-- 1. UPDATE ALL TRIGGER FUNCTIONS WITH SEARCH_PATH
-- =====================================================

CREATE OR REPLACE FUNCTION update_asset_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_asset_assignments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_department_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION populate_notification_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.actor_id IS NOT NULL AND NEW.actor_name IS NULL THEN
    SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO NEW.actor_name
    FROM profiles
    WHERE id = NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_asset_deletion_allowed(asset_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_assignments BOOLEAN;
  v_has_issues BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM asset_assignments
    WHERE asset_id = check_asset_deletion_allowed.asset_id
  ) INTO v_has_assignments;
  
  SELECT EXISTS (
    SELECT 1 FROM asset_issues
    WHERE asset_id = check_asset_deletion_allowed.asset_id
  ) INTO v_has_issues;
  
  RETURN NOT (v_has_assignments OR v_has_issues);
END;
$$;

-- Add any other missing functions
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND is_read = TRUE;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- 2. RECREATE VIEWS AS SECURITY INVOKER (NOT DEFINER)
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS office_locations_by_type CASCADE;
DROP VIEW IF EXISTS office_location_usage CASCADE;

-- Recreate as SECURITY INVOKER (default, but explicit)
CREATE VIEW office_locations_by_type
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  type,
  department,
  description,
  is_active,
  CASE
    WHEN type = 'department_office' THEN 'Department Office'
    WHEN type = 'common_area' THEN 'Common Area'
    WHEN type = 'conference_room' THEN 'Conference Room'
    WHEN type = 'office' THEN 'Executive Office'
    ELSE 'Other'
  END AS type_label
FROM office_locations
WHERE is_active = true
ORDER BY
  CASE type
    WHEN 'office' THEN 1
    WHEN 'department_office' THEN 2
    WHEN 'conference_room' THEN 3
    WHEN 'common_area' THEN 4
    ELSE 5
  END, department, name;

CREATE VIEW office_location_usage
WITH (security_invoker = true)
AS
SELECT 
  ol.name,
  ol.type,
  ol.department,
  COUNT(a.id) AS asset_count,
  ol.is_active
FROM office_locations ol
LEFT JOIN assets a ON a.office_location = ol.name AND a.assignment_type = 'office'
GROUP BY ol.id, ol.name, ol.type, ol.department, ol.is_active
ORDER BY COUNT(a.id) DESC, ol.name;

-- Add comments
COMMENT ON VIEW office_locations_by_type IS 'Categorized view of active office locations with type labels (SECURITY INVOKER)';
COMMENT ON VIEW office_location_usage IS 'Office locations with asset usage statistics (SECURITY INVOKER)';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
