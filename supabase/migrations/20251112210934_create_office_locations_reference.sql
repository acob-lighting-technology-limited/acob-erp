
-- Create a reference table for standardized office locations
-- This will help maintain consistency across assets and profiles

CREATE TABLE IF NOT EXISTS office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('office', 'department_office', 'conference_room', 'common_area')),
  department TEXT, -- Link to department if it's a department-specific office
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert existing office locations from assets
INSERT INTO office_locations (name, type, department) VALUES
  ('MD Office', 'office', NULL),
  ('Assistant Executive Director', 'office', NULL),
  ('General Conference Room', 'conference_room', NULL),
  ('Reception', 'common_area', NULL),
  ('Media/Control', 'common_area', NULL),
  ('Accounts', 'department_office', 'Accounts'),
  ('Admin & HR', 'department_office', 'Admin & HR'),
  ('Technical', 'department_office', 'Technical'),
  ('Technical Extension', 'department_office', 'Technical'),
  ('Operations', 'department_office', 'Operations'),
  ('Business, Growth and Innovation', 'department_office', 'Business Growth and Innovation'),
  ('Legal, Regulatory and Compliance', 'department_office', 'Legal, Regulatory and Compliance')
ON CONFLICT (name) DO NOTHING;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_office_locations_type ON office_locations(type);
CREATE INDEX IF NOT EXISTS idx_office_locations_department ON office_locations(department);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_office_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_office_locations_updated_at ON office_locations;
CREATE TRIGGER trigger_update_office_locations_updated_at
  BEFORE UPDATE ON office_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_office_locations_updated_at();

-- Create a view to show office location usage
CREATE OR REPLACE VIEW office_location_usage AS
SELECT 
  ol.name,
  ol.type,
  ol.department,
  COUNT(a.id) AS asset_count,
  ol.is_active
FROM office_locations ol
LEFT JOIN assets a ON a.office_location = ol.name AND a.assignment_type = 'office'
GROUP BY ol.id, ol.name, ol.type, ol.department, ol.is_active
ORDER BY asset_count DESC, ol.name;

COMMENT ON TABLE office_locations IS 'Reference table for standardized office locations used across the system';
COMMENT ON COLUMN office_locations.type IS 'Type of location: office (executive), department_office, conference_room, or common_area';
COMMENT ON VIEW office_location_usage IS 'Shows how many assets are assigned to each office location';
;
