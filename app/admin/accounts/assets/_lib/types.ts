// Shapes shared by the assets page and the asset dialogs. Re-exported from admin-assets-content.tsx, so existing
// imports keep working.

export interface Asset {
  id: string
  unique_code: string
  asset_type: string
  acquisition_year: number
  asset_model?: string
  serial_number?: string
  status: string
  notes?: string
  created_at: string
  created_by: string
  assignment_type?: "individual" | "department" | "office"
  department?: string
  office_location?: string
  current_assignment?: {
    assigned_to?: string
    department?: string
    office_location?: string
    assignment_type?: "individual" | "department" | "office" | string
    user?: {
      first_name: string
      last_name: string
    }
  }
  issues?: AssetIssue[]
  unresolved_issues_count?: number
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
}

export interface AssetIssue {
  id: string
  asset_id: string
  description: string
  resolved: boolean
  created_at: string
  resolved_at?: string
  resolved_by?: string
  created_by: string
}

export interface Employee {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
  employment_status?: string | null
  designation?: string | null
  residential_address?: string | null
}

export interface AssetAssignment {
  id: string
  assigned_to?: string
  department?: string
  office_location?: string
  assignment_type?: string
  assigned_at: string
  is_current: boolean
  user?: {
    first_name: string
    last_name: string
    designation?: string | null
    residential_address?: string | null
  }
}

export type AssignableAsset = {
  status: string
  assignment_type?: string
  department?: string
  office_location?: string
  current_assignment?: {
    assigned_to?: string
    department?: string
    office_location?: string
    assignment_type?: string
    user?: {
      first_name: string
      last_name: string
      designation?: string | null
      residential_address?: string | null
    }
  }
}

export type ProfileNameRow = {
  id: string
  first_name?: string | null
  last_name?: string | null
}

export interface AssetActivity {
  id: string
  timestamp: string
  type: "assignment" | "unassignment" | "status_change" | "issue_reported" | "issue_resolved"
  title: string
  description?: string
  user_name?: string
  performed_by_name?: string
  details?: {
    assigned_to?: string
    department?: string
    office_location?: string
    assignment_type?: string
    notes?: string
    status?: string
    old_status?: string
  }
}

export interface UserProfile {
  first_name?: string | null
  last_name?: string | null
  role: string
  admin_routes?: string[] | null
  is_department_lead?: boolean
  lead_departments?: string[]
  managed_departments?: string[]
  managed_offices?: string[]
}
