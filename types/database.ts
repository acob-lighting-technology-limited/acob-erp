export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          employee_number: string | null // Unique employee identifier: ACOB/YEAR/NUMBER
          company_email: string
          first_name: string
          last_name: string
          full_name: string | null // NEW: Computed column
          other_names: string | null
          department: string | null // DEPRECATED: Use department_id
          department_id: string | null // NEW: Foreign key to departments
          company_role: string | null
          phone_number: string | null
          additional_phone: string | null
          residential_address: string | null
          current_work_location: string | null
          office_location: string | null
          bank_name: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          date_of_birth: string | null
          employment_date: string | null
          is_admin: boolean
          role: Database["public"]["Enums"]["user_role"]
          is_department_lead: boolean
          lead_departments: string[]
          job_description: string | null
          job_description_updated_at: string | null
          created_at: string
          updated_at: string
          // Employment status fields
          employment_status: Database["public"]["Enums"]["employment_status"]
          status_changed_at: string | null
          status_changed_by: string | null
          separation_date: string | null
          separation_reason: string | null
          // DEPRECATED fields (use assets table instead)
          device_allocated: boolean | null
          device_type: string | null
          device_model: string | null
          devices: string[] | null
        }
        Insert: {
          id: string
          employee_number?: string | null
          company_email: string
          first_name: string
          last_name: string
          other_names?: string | null
          department?: string | null
          department_id?: string | null
          company_role?: string | null
          phone_number?: string | null
          additional_phone?: string | null
          residential_address?: string | null
          current_work_location?: string | null
          office_location?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          date_of_birth?: string | null
          employment_date?: string | null
          is_admin?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          is_department_lead?: boolean
          lead_departments?: string[]
          job_description?: string | null
          job_description_updated_at?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          separation_date?: string | null
          separation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          employee_number?: string | null
          company_email?: string
          first_name?: string
          last_name?: string
          other_names?: string | null
          department?: string | null
          department_id?: string | null
          company_role?: string | null
          phone_number?: string | null
          additional_phone?: string | null
          residential_address?: string | null
          current_work_location?: string | null
          office_location?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          date_of_birth?: string | null
          employment_date?: string | null
          is_admin?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          is_department_lead?: boolean
          lead_departments?: string[]
          job_description?: string | null
          job_description_updated_at?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          separation_date?: string | null
          separation_reason?: string | null
          updated_at?: string
        }
      }
      department_payments: {
        Row: {
          id: string
          department_id: string
          payment_type: string
          category: string
          title: string
          description: string | null
          amount: number | null
          currency: string
          recurrence_period: string | null
          next_payment_due: string | null
          last_payment_date: string | null
          payment_date: string | null
          status: string
          payment_reference: string | null
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
          issuer_name: string | null
          issuer_phone_number: string | null
          issuer_address: string | null
          amount_paid: number | null
          // NEW: Starlink consolidation fields
          invoice_number: string | null
          site_id: string | null
          site_name: string | null
          site_state: string | null
          site_serial_number: string | null
        }
        Insert: {
          id?: string
          department_id: string
          payment_type: string
          category: string
          title: string
          description?: string | null
          amount?: number | null
          currency?: string
          recurrence_period?: string | null
          next_payment_due?: string | null
          last_payment_date?: string | null
          payment_date?: string | null
          status?: string
          payment_reference?: string | null
          notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          issuer_name?: string | null
          issuer_phone_number?: string | null
          issuer_address?: string | null
          amount_paid?: number | null
          invoice_number?: string | null
          site_id?: string | null
          site_name?: string | null
          site_state?: string | null
          site_serial_number?: string | null
        }
        Update: {
          department_id?: string
          payment_type?: string
          category?: string
          title?: string
          description?: string | null
          amount?: number | null
          currency?: string
          recurrence_period?: string | null
          next_payment_due?: string | null
          last_payment_date?: string | null
          payment_date?: string | null
          status?: string
          payment_reference?: string | null
          notes?: string | null
          updated_at?: string
          issuer_name?: string | null
          issuer_phone_number?: string | null
          issuer_address?: string | null
          amount_paid?: number | null
          invoice_number?: string | null
          site_id?: string | null
          site_name?: string | null
          site_state?: string | null
          site_serial_number?: string | null
        }
      }
      office_locations: {
        Row: {
          id: string
          name: string
          type: string
          department: string | null
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          site: string | null // NEW: Site location
        }
        Insert: {
          id?: string
          name: string
          type: string
          department?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          site?: string | null
        }
        Update: {
          name?: string
          type?: string
          department?: string | null
          description?: string | null
          is_active?: boolean
          updated_at?: string
          site?: string | null
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
    }
    Enums: {
      user_role: "visitor" | "employee" | "lead" | "admin" | "super_admin"
      employment_status: "active" | "suspended" | "separated" | "on_leave"
    }
  }
}

// Legacy type exports for backward compatibility
export type UserRole = Database["public"]["Enums"]["user_role"]
export type EmploymentStatus = Database["public"]["Enums"]["employment_status"]

export type DeviceStatus = "available" | "assigned" | "maintenance" | "retired"
export type AssetStatus = "available" | "assigned" | "maintenance" | "retired"
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "urgent"
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled"
export type ProjectMemberRole = "member" | "lead" | "manager"
export type ProjectItemStatus = "pending" | "ordered" | "received" | "installed"

// Updated Profile interface with new fields
export interface Profile {
  id: string
  employee_number?: string | null // Unique employee identifier: ACOB/YEAR/NUMBER
  company_email: string
  first_name: string
  last_name: string
  full_name?: string | null // NEW: Computed full name
  other_names?: string
  department?: string // DEPRECATED: Use department_id
  department_id?: string | null // NEW: Foreign key
  company_role?: string
  phone_number?: string
  additional_phone?: string
  residential_address?: string
  current_work_location?: string
  office_location?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
  date_of_birth?: string
  employment_date?: string
  is_admin: boolean
  role: UserRole
  is_department_lead: boolean
  lead_departments: string[]
  job_description?: string
  job_description_updated_at?: string
  employment_status: EmploymentStatus
  status_changed_at?: string
  status_changed_by?: string
  separation_date?: string
  separation_reason?: string
  created_at: string
  updated_at: string
}

// Updated DepartmentPayment interface with new fields
export interface DepartmentPayment {
  id: string
  department_id: string
  payment_type: string
  category: string
  title: string
  description?: string
  amount?: number
  currency: string
  recurrence_period?: string
  next_payment_due?: string
  last_payment_date?: string
  payment_date?: string
  status: string
  payment_reference?: string
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
  issuer_name?: string
  issuer_phone_number?: string
  issuer_address?: string
  amount_paid?: number
  // NEW: Starlink consolidation fields
  invoice_number?: string
  site_id?: string
  site_name?: string
  site_state?: string
  site_serial_number?: string
}

// Updated OfficeLocation interface with new field
export interface OfficeLocation {
  id: string
  name: string
  type: string
  department?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  site?: string | null // NEW: Site location
}

export interface Department {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Keep existing interfaces for backward compatibility
export interface Device {
  id: string
  device_name: string
  device_type: string
  device_model?: string
  serial_number?: string
  purchase_date?: string
  notes?: string
  status: DeviceStatus
  created_at: string
  updated_at: string
  created_by: string
}

export interface DeviceAssignment {
  id: string
  device_id: string
  assigned_to: string
  assigned_from?: string
  assigned_by: string
  assigned_at: string
  handed_over_at?: string
  assignment_notes?: string
  handover_notes?: string
  is_current: boolean
  created_at: string
}

export interface Asset {
  id: string
  asset_name: string
  asset_type: string
  asset_model?: string
  serial_number?: string
  purchase_date?: string
  purchase_cost?: number
  notes?: string
  status: AssetStatus
  created_at: string
  updated_at: string
  created_by: string
}

export interface AssetAssignment {
  id: string
  asset_id: string
  assigned_to: string
  assigned_from?: string
  assigned_by: string
  assigned_at: string
  handed_over_at?: string
  assignment_notes?: string
  handover_notes?: string
  is_current: boolean
  created_at: string
}

export interface Task {
  id: string
  title: string
  description?: string
  priority: TaskPriority
  status: TaskStatus
  assigned_to: string
  assigned_by: string
  department?: string
  due_date?: string
  started_at?: string
  completed_at?: string
  progress: number
  project_id?: string
  task_start_date?: string
  task_end_date?: string
  created_at: string
  updated_at: string
}

export interface TaskUpdate {
  id: string
  task_id: string
  user_id: string
  update_type: "comment" | "status_change" | "progress_update"
  content?: string
  old_value?: string
  new_value?: string
  created_at: string
}

export interface UserDocumentation {
  id: string
  user_id: string
  title: string
  content: string
  category?: string
  tags?: string[]
  is_draft: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  old_values?: any
  new_values?: any
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface Project {
  id: string
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w?: number
  technology_type?: string
  project_manager_id?: string
  description?: string
  status: ProjectStatus
  created_by: string
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectMemberRole
  assigned_by: string
  assigned_at: string
  removed_at?: string
  is_active: boolean
  created_at: string
}

export interface ProjectItem {
  id: string
  project_id: string
  item_name: string
  description?: string
  quantity: number
  unit?: string
  status: ProjectItemStatus
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectUpdate {
  id: string
  project_id: string
  user_id: string
  update_type: "comment" | "status_change" | "milestone" | "member_added" | "member_removed"
  content?: string
  old_value?: string
  new_value?: string
  created_at: string
}
