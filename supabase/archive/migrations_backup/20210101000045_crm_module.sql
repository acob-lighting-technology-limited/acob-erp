-- Migration: Create CRM Module Tables
-- Description: Core CRM tables for contacts, opportunities, activities, and pipelines

-- ============================================
-- CRM Pipelines (must be created first for references)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  stages JSONB NOT NULL DEFAULT '[
    {"name": "New", "order": 1, "probability": 10},
    {"name": "Qualified", "order": 2, "probability": 25},
    {"name": "Proposal", "order": 3, "probability": 50},
    {"name": "Negotiation", "order": 4, "probability": 75},
    {"name": "Won", "order": 5, "probability": 100},
    {"name": "Lost", "order": 6, "probability": 0}
  ]'::jsonb,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one default pipeline
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_pipelines_default 
ON crm_pipelines (is_default) WHERE is_default = TRUE;

-- ============================================
-- CRM Contacts (Leads, Customers, Vendors, Partners)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Type classification
  type TEXT NOT NULL DEFAULT 'lead' CHECK (type IN ('lead', 'customer', 'vendor', 'partner')),
  
  -- Basic info
  company_name TEXT,
  contact_name TEXT NOT NULL,
  title TEXT, -- Job title
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  
  -- Address (structured)
  address JSONB DEFAULT '{}'::jsonb,
  -- Expected structure: {"street": "", "city": "", "state": "", "country": "", "postal_code": ""}
  
  -- Business info
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  annual_revenue DECIMAL(15,2),
  
  -- Lead tracking
  source TEXT, -- website, referral, cold_call, trade_show, advertisement, social_media, other
  source_details TEXT, -- More specific info about source
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  
  -- Pipeline stage (for leads)
  pipeline_id UUID REFERENCES crm_pipelines(id),
  stage TEXT DEFAULT 'new',
  
  -- Scoring
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  
  -- Tags for categorization
  tags TEXT[] DEFAULT '{}',
  
  -- Follow-up
  next_follow_up TIMESTAMPTZ,
  last_contact_date TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  
  -- Conversion tracking
  converted_to_customer_at TIMESTAMPTZ,
  converted_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_crm_contacts_type ON crm_contacts(type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to ON crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company_name);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_next_follow_up ON crm_contacts(next_follow_up);

-- ============================================
-- CRM Opportunities (Deals)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Value
  value DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'NGN',
  
  -- Probability & Pipeline
  probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  weighted_value DECIMAL(15,2) GENERATED ALWAYS AS (value * probability / 100) STORED,
  
  pipeline_id UUID REFERENCES crm_pipelines(id),
  stage TEXT DEFAULT 'qualification',
  
  -- Dates
  expected_close DATE,
  actual_close_date DATE,
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  
  -- Outcome
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  won_date TIMESTAMPTZ,
  lost_date TIMESTAMPTZ,
  lost_reason TEXT,
  competitor TEXT, -- Who we lost to, if applicable
  
  -- Tags
  tags TEXT[] DEFAULT '{}',
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_contact ON crm_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_assigned ON crm_opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON crm_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_status ON crm_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_expected_close ON crm_opportunities(expected_close);

-- ============================================
-- CRM Activities (Calls, Emails, Meetings, Tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships (at least one should be set)
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  
  -- Activity type
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task', 'follow_up')),
  
  -- Content
  subject TEXT NOT NULL,
  description TEXT,
  
  -- Scheduling
  due_date TIMESTAMPTZ,
  duration_minutes INTEGER, -- For calls/meetings
  
  -- Location (for meetings)
  location TEXT,
  
  -- Completion
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  outcome TEXT, -- Result of the activity
  
  -- Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  
  -- Reminder
  reminder_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure at least one relationship
  CONSTRAINT activity_has_parent CHECK (contact_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity ON crm_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_assigned ON crm_activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_completed ON crm_activities(completed);

-- ============================================
-- CRM Tags (Reusable tags)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6', -- Hex color
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Updated_at Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER update_crm_opportunities_updated_at
  BEFORE UPDATE ON crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER update_crm_activities_updated_at
  BEFORE UPDATE ON crm_activities
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

-- ============================================
-- Insert Default Pipeline
-- ============================================
INSERT INTO crm_pipelines (name, description, is_default, stages)
VALUES (
  'Default Sales Pipeline',
  'Standard sales pipeline for tracking opportunities',
  TRUE,
  '[
    {"name": "New", "order": 1, "probability": 10},
    {"name": "Qualified", "order": 2, "probability": 25},
    {"name": "Proposal", "order": 3, "probability": 50},
    {"name": "Negotiation", "order": 4, "probability": 75},
    {"name": "Won", "order": 5, "probability": 100},
    {"name": "Lost", "order": 6, "probability": 0}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies - Pipelines
-- ============================================
-- Everyone authenticated can view pipelines
CREATE POLICY "Pipelines viewable by all authenticated" ON crm_pipelines
  FOR SELECT TO authenticated USING (TRUE);

-- Only admins can manage pipelines
CREATE POLICY "Admins can manage pipelines" ON crm_pipelines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- RLS Policies - Contacts
-- ============================================
-- Admins and leads can view all contacts
CREATE POLICY "Admins view all contacts" ON crm_contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'lead')
    )
  );

-- employee can view contacts assigned to them
CREATE POLICY "employee view assigned contacts" ON crm_contacts
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

-- Admins and leads can create contacts
CREATE POLICY "Admins and leads can create contacts" ON crm_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'lead', 'employee')
    )
  );

-- Users can update contacts they own or are assigned to (admins can update all)
CREATE POLICY "Users can update own contacts" ON crm_contacts
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Only admins can delete contacts
CREATE POLICY "Admins can delete contacts" ON crm_contacts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- RLS Policies - Opportunities
-- ============================================
-- Admins and leads can view all opportunities
CREATE POLICY "Admins view all opportunities" ON crm_opportunities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'lead')
    )
  );

-- employee can view opportunities assigned to them
CREATE POLICY "employee view assigned opportunities" ON crm_opportunities
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

-- employee+ can create opportunities
CREATE POLICY "employee can create opportunities" ON crm_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'lead', 'employee')
    )
  );

-- Users can update their own opportunities
CREATE POLICY "Users can update own opportunities" ON crm_opportunities
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Only admins can delete opportunities
CREATE POLICY "Admins can delete opportunities" ON crm_opportunities
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- RLS Policies - Activities
-- ============================================
-- Admins and leads can view all activities
CREATE POLICY "Admins view all activities" ON crm_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'lead')
    )
  );

-- employee can view their activities
CREATE POLICY "employee view own activities" ON crm_activities
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- employee+ can create activities
CREATE POLICY "employee can create activities" ON crm_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'lead', 'employee')
    )
  );

-- Users can update their own activities
CREATE POLICY "Users can update own activities" ON crm_activities
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Users can delete their own activities, admins can delete any
CREATE POLICY "Users can delete own activities" ON crm_activities
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- RLS Policies - Tags
-- ============================================
-- Everyone can view tags
CREATE POLICY "Tags viewable by all" ON crm_tags
  FOR SELECT TO authenticated USING (TRUE);

-- Only admins can manage tags
CREATE POLICY "Admins manage tags" ON crm_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- Audit Triggers
-- ============================================
-- Contact audit trigger
CREATE OR REPLACE FUNCTION log_crm_contact_audit()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (auth.uid(), 'create', 'crm_contact', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), 'update', 'crm_contact', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
    VALUES (auth.uid(), 'delete', 'crm_contact', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_contact_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION log_crm_contact_audit();

-- Opportunity audit trigger
CREATE OR REPLACE FUNCTION log_crm_opportunity_audit()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (auth.uid(), 'create', 'crm_opportunity', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), 'update', 'crm_opportunity', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
    VALUES (auth.uid(), 'delete', 'crm_opportunity', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_opportunity_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION log_crm_opportunity_audit();

-- ============================================  
-- Comments
-- ============================================
COMMENT ON TABLE crm_contacts IS 'CRM contacts - leads, customers, vendors, and partners';
COMMENT ON TABLE crm_opportunities IS 'Sales opportunities/deals linked to contacts';
COMMENT ON TABLE crm_activities IS 'Activities like calls, emails, meetings linked to contacts or opportunities';
COMMENT ON TABLE crm_pipelines IS 'Sales pipelines with configurable stages';
COMMENT ON TABLE crm_tags IS 'Reusable tags for categorizing CRM records';
