-- ============================================
-- Project Management System
-- ============================================

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  location TEXT NOT NULL,
  deployment_start_date DATE NOT NULL,
  deployment_end_date DATE NOT NULL,
  capacity_w NUMERIC, -- Capacity in Watts (optional)
  technology_type TEXT, -- optional
  project_manager_id UUID REFERENCES profiles(id), -- optional, dropdown of employee
  description TEXT,
  status TEXT DEFAULT 'planning', -- planning, active, on_hold, completed, cancelled
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Project members table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  role TEXT DEFAULT 'member', -- member, lead, manager
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project items table
CREATE TABLE IF NOT EXISTS project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit TEXT, -- units, pieces, etc.
  status TEXT DEFAULT 'pending', -- pending, ordered, received, installed
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project updates/comments
CREATE TABLE IF NOT EXISTS project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  update_type TEXT, -- comment, status_change, milestone, member_added, member_removed
  content TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update tasks table to support project assignment
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS task_start_date DATE,
ADD COLUMN IF NOT EXISTS task_end_date DATE;

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(deployment_start_date, deployment_end_date);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_is_active ON project_members(is_active);
CREATE INDEX IF NOT EXISTS idx_project_items_project_id ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

-- Projects policies
-- Users can view projects they're members of, created, or if they're admin/lead
CREATE POLICY "Users can view their projects" ON projects FOR SELECT USING (
  created_by = auth.uid() OR
  project_manager_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = projects.id
    AND project_members.user_id = auth.uid()
    AND project_members.is_active = true
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Only leads, admin, super_admin can create projects
CREATE POLICY "Leads/admin/super_admin can create projects" ON projects FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Project creator, manager, or admin/lead can update
CREATE POLICY "Project stakeholders can update projects" ON projects FOR UPDATE USING (
  created_by = auth.uid() OR
  project_manager_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Only admin/super_admin can delete projects
CREATE POLICY "Only admin can delete projects" ON projects FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- Project members policies
-- Users can view members of projects they have access to
CREATE POLICY "Users can view project members" ON project_members FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_members.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members pm2
        WHERE pm2.project_id = projects.id
        AND pm2.user_id = auth.uid()
        AND pm2.is_active = true
      )
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Project manager or admin can add members
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

-- Project manager or admin can update members
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
-- Users can view items of projects they have access to
CREATE POLICY "Users can view project items" ON project_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_items.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.is_active = true
      )
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Project members can add items
CREATE POLICY "Project members can add items" ON project_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_items.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.is_active = true
      )
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Project members can update items
CREATE POLICY "Project members can update items" ON project_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_items.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.is_active = true
      )
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Project manager or admin can delete items
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
-- Users can view updates for projects they have access to
CREATE POLICY "Users can view project updates" ON project_updates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_updates.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.is_active = true
      )
    )
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'lead')
  )
);

-- Project members can create updates
CREATE POLICY "Project members can create updates" ON project_updates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_updates.project_id
    AND (
      projects.created_by = auth.uid() OR
      projects.project_manager_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.is_active = true
      )
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
