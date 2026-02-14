-- ============================================
-- Assets Management System
-- ============================================

-- Assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name TEXT,
  asset_type TEXT NOT NULL, -- furniture, equipment, vehicle, other
  asset_model TEXT,
  serial_number TEXT,
  unique_code TEXT NOT NULL,
  acquisition_year INTEGER,
  notes TEXT,
  status TEXT DEFAULT 'available', -- available, assigned, maintenance, retired
  assignment_type TEXT,
  department TEXT,
  office_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Asset assignments table (tracks history)
CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_from UUID REFERENCES auth.users(id), -- previous user (null if new assignment)
  assigned_by UUID REFERENCES auth.users(id), -- admin who made the assignment
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  handed_over_at TIMESTAMPTZ, -- when asset was returned/transferred
  assignment_notes TEXT,
  handover_notes TEXT,
  is_current BOOLEAN DEFAULT true,
  department TEXT,
  assignment_type TEXT DEFAULT 'individual',
  office_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: only one current assignment per asset
CREATE UNIQUE INDEX IF NOT EXISTS unique_current_asset_assignment 
ON asset_assignments(asset_id) 
WHERE is_current = true;

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset_id ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_to ON asset_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_is_current ON asset_assignments(is_current);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;

-- Assets policies
CREATE POLICY "Users can view all assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Only super_admin/admin can create assets" ON assets FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'admin'))
  )
);
CREATE POLICY "Only super_admin/admin can update assets" ON assets FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'admin'))
  )
);
CREATE POLICY "Only super_admin/admin can delete assets" ON assets FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'admin'))
  )
);

-- Asset assignments policies
CREATE POLICY "Users can view their own asset assignments" ON asset_assignments FOR SELECT USING (
  assigned_to = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'admin', 'lead'))
  )
);
CREATE POLICY "Only super_admin/admin can create asset assignments" ON asset_assignments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'admin'))
  )
);
CREATE POLICY "Only super_admin/admin can update asset assignments" ON asset_assignments FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'admin'))
  )
);

-- ============================================
-- Triggers for Updated At
-- ============================================

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON assets TO authenticated;
GRANT ALL ON asset_assignments TO authenticated;
