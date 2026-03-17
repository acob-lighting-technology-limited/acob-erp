
-- CRM Pipelines
CREATE TABLE IF NOT EXISTS crm_pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  stages JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CRM Contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('lead', 'customer', 'vendor', 'partner')),
  company_name TEXT,
  contact_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  address JSONB,
  industry TEXT,
  company_size TEXT,
  annual_revenue NUMERIC,
  source TEXT,
  assigned_to UUID,
  pipeline_id UUID REFERENCES crm_pipelines(id),
  stage TEXT NOT NULL DEFAULT 'new',
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  tags TEXT[] DEFAULT '{}',
  next_follow_up TIMESTAMPTZ,
  notes TEXT,
  meter_customer_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CRM Opportunities
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'NGN',
  probability INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  pipeline_id UUID REFERENCES crm_pipelines(id),
  stage TEXT NOT NULL DEFAULT 'qualification',
  expected_close DATE,
  assigned_to UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CRM Activities
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task', 'follow_up')),
  subject TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID,
  reminder_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CRM Tags
CREATE TABLE IF NOT EXISTS crm_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
;
