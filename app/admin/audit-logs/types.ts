/**
 * Shared type definitions for the audit logs feature.
 * Imported by the server page, client component, and all sub-components.
 */

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  created_at: string
  department?: string | null
  changed_fields?: string[]
  metadata?: Record<string, unknown>
  user?: {
    first_name: string
    last_name: string
    company_email: string
    employee_number?: string
  }
  target_user?: {
    first_name: string
    last_name: string
    company_email: string
    employee_number?: string
  }
  task_info?: {
    title: string
    assigned_to?: string
    assigned_to_user?: { first_name: string; last_name: string }
  }
  device_info?: {
    device_name: string
    assigned_to?: string
    assigned_to_user?: { first_name: string; last_name: string }
  }
  asset_info?: {
    asset_name: string
    unique_code?: string
    serial_number?: string
    assignment_type?: string
    assigned_to?: string
    assigned_to_user?: { first_name: string; last_name: string }
  }
  payment_info?: {
    title: string
    amount: number
    currency: string
    department_name?: string
  }
  document_info?: {
    file_name: string
    document_type: string
    department_name?: string
  }
  department_info?: { name: string }
  category_info?: { name: string }
  leave_request_info?: {
    user_id: string
    leave_type_name: string
    requester_user?: { first_name: string; last_name: string }
  }
}

export interface EmployeeMember {
  id: string
  first_name: string
  last_name: string
  department: string
}

export interface UserProfile {
  role: string
  is_department_lead?: boolean
  lead_departments?: string[]
  managed_departments?: string[]
}

export interface AuditLogFiltersState {
  searchQuery: string
  actionFilter: string
  entityFilter: string
  dateFilter: string
  departmentFilter: string
  employeeFilter: string
  customStartDate: string
  customEndDate: string
}
