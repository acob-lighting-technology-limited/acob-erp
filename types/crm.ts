// CRM Module Types

export interface CRMPipeline {
  id: string
  name: string
  description?: string
  stages: PipelineStage[]
  is_default: boolean
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  name: string
  order: number
  probability: number
}

export interface CRMContact {
  id: string
  type: "lead" | "customer" | "vendor" | "partner"
  company_name?: string
  contact_name: string
  title?: string
  email?: string
  phone?: string
  mobile?: string
  website?: string
  address?: CRMAddress
  industry?: string
  company_size?: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+"
  annual_revenue?: number
  source?: string
  source_details?: string
  assigned_to?: string
  assigned_user?: {
    id: string
    first_name: string
    last_name: string
  }
  pipeline_id?: string
  stage: string
  score: number
  tags: string[]
  next_follow_up?: string
  last_contact_date?: string
  notes?: string
  converted_to_customer_at?: string
  converted_by?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CRMAddress {
  street?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
}

export interface CRMOpportunity {
  id: string
  contact_id?: string
  contact?: CRMContact
  name: string
  description?: string
  value: number
  currency: string
  probability: number
  weighted_value: number
  pipeline_id?: string
  pipeline?: CRMPipeline
  stage: string
  expected_close?: string
  actual_close_date?: string
  assigned_to?: string
  assigned_user?: {
    id: string
    first_name: string
    last_name: string
  }
  status: "open" | "won" | "lost"
  won_date?: string
  lost_date?: string
  lost_reason?: string
  competitor?: string
  tags: string[]
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CRMActivity {
  id: string
  contact_id?: string
  contact?: CRMContact
  opportunity_id?: string
  opportunity?: CRMOpportunity
  type: "call" | "email" | "meeting" | "note" | "task" | "follow_up"
  subject: string
  description?: string
  due_date?: string
  duration_minutes?: number
  location?: string
  completed: boolean
  completed_at?: string
  outcome?: string
  priority: "low" | "normal" | "high" | "urgent"
  assigned_to?: string
  assigned_user?: {
    id: string
    first_name: string
    last_name: string
  }
  reminder_at?: string
  reminder_sent: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CRMTag {
  id: string
  name: string
  color: string
  description?: string
  created_at: string
}

// Form types for creating/updating
export interface CreateContactInput {
  type: CRMContact["type"]
  company_name?: string
  contact_name: string
  title?: string
  email?: string
  phone?: string
  mobile?: string
  website?: string
  address?: CRMAddress
  industry?: string
  company_size?: CRMContact["company_size"]
  annual_revenue?: number
  source?: string
  source_details?: string
  assigned_to?: string
  pipeline_id?: string
  stage?: string
  score?: number
  tags?: string[]
  next_follow_up?: string
  notes?: string
}

export interface UpdateContactInput extends Partial<CreateContactInput> {
  id: string
}

export interface CreateOpportunityInput {
  contact_id?: string
  name: string
  description?: string
  value?: number
  currency?: string
  probability?: number
  pipeline_id?: string
  stage?: string
  expected_close?: string
  assigned_to?: string
  tags?: string[]
  notes?: string
}

export interface UpdateOpportunityInput extends Partial<CreateOpportunityInput> {
  id: string
  status?: CRMOpportunity["status"]
  won_date?: string
  lost_date?: string
  lost_reason?: string
  competitor?: string
}

export interface CreateActivityInput {
  contact_id?: string
  opportunity_id?: string
  type: CRMActivity["type"]
  subject: string
  description?: string
  due_date?: string
  duration_minutes?: number
  location?: string
  priority?: CRMActivity["priority"]
  assigned_to?: string
  reminder_at?: string
}

export interface UpdateActivityInput extends Partial<CreateActivityInput> {
  id: string
  completed?: boolean
  completed_at?: string
  outcome?: string
}

// Dashboard metrics
export interface CRMDashboardMetrics {
  total_contacts: number
  leads_count: number
  customers_count: number
  open_opportunities: number
  total_pipeline_value: number
  weighted_pipeline_value: number
  won_this_month: number
  won_value_this_month: number
  activities_due_today: number
  overdue_activities: number
  conversion_rate: number
}

// Filter types
export interface ContactFilters {
  type?: CRMContact["type"]
  stage?: string
  assigned_to?: string
  source?: string
  tags?: string[]
  search?: string
}

export interface OpportunityFilters {
  status?: CRMOpportunity["status"]
  stage?: string
  pipeline_id?: string
  assigned_to?: string
  min_value?: number
  max_value?: number
  expected_close_from?: string
  expected_close_to?: string
  search?: string
}

export interface ActivityFilters {
  type?: CRMActivity["type"]
  completed?: boolean
  priority?: CRMActivity["priority"]
  assigned_to?: string
  due_from?: string
  due_to?: string
  contact_id?: string
  opportunity_id?: string
}
