-- Fix Office Locations RLS Policies
-- CRITICAL: This table was completely exposed without any RLS policies

-- Office Locations Policies
CREATE POLICY "All authenticated users can view office locations"
  ON office_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only super_admin and admin can insert office locations"
  ON office_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only super_admin and admin can update office locations"
  ON office_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only super_admin can delete office locations"
  ON office_locations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Add comment
COMMENT ON TABLE office_locations IS 'Physical office locations and rooms within the company';
