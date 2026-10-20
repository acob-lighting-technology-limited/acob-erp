-- ============================================
-- Fix Foreign Key References for Projects System
-- ============================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS project_updates CASCADE;
DROP TABLE IF EXISTS project_items CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Projects table with correct foreign keys to profiles
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  location TEXT NOT NULL,
  deployment_start_date DATE NOT NULL,
  deployment_end_date DATE NOT NULL,
  capacity_w NUMERIC,
  technology_type TEXT,
  project_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Project members table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'lead', 'manager')),
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id, is_active)
);

-- Project items table
CREATE TABLE project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'installed')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project updates/comments
CREATE TABLE project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  update_type TEXT CHECK (update_type IN ('comment', 'status_change', 'milestone', 'member_added', 'member_removed')),
  content TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_manager ON projects(project_manager_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_dates ON projects(deployment_start_date, deployment_end_date);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_is_active ON project_members(is_active);
CREATE INDEX idx_project_items_project_id ON project_items(project_id);
CREATE INDEX idx_project_updates_project_id ON project_updates(project_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

-- Projects policies
-- Admins can see all, others can see projects they created or manage
CREATE POLICY "Users can view their projects" ON projects FOR SELECT USING (
  created_by = auth.uid() OR
  project_manager_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Leads/admin/super_admin can create projects" ON projects FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Project stakeholders can update projects" ON projects FOR UPDATE USING (
  created_by = auth.uid() OR
  project_manager_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Only admin can delete projects" ON projects FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- Project members policies
CREATE POLICY "Users can view project members" ON project_members FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_members.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Project managers can add members" ON project_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_members.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Project managers can update members" ON project_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_members.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Project items policies
-- Note: We avoid checking project_members to prevent infinite recursion
CREATE POLICY "Users can view project items" ON project_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_items.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Project members can add items" ON project_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_items.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Project members can update items" ON project_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_items.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Project managers can delete items" ON project_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_items.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- Project updates policies
-- Note: We avoid checking project_members to prevent infinite recursion
CREATE POLICY "Users can view project updates" ON project_updates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_updates.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

CREATE POLICY "Project members can create updates" ON project_updates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_updates.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid()
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- ============================================
-- Triggers for Updated_at Timestamps
-- ============================================

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_items_updated_at BEFORE UPDATE ON project_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON projects TO authenticated;
GRANT ALL ON project_members TO authenticated;
GRANT ALL ON project_items TO authenticated;
GRANT ALL ON project_updates TO authenticated;
