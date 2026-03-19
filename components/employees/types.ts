import type { EmploymentStatus } from "@/types/database"
import type { Employee } from "@/app/admin/hr/employees/admin-employee-content"

export type EmployeeProfile = Employee & {
  additional_phone?: string | null
  job_description?: string | null
  separation_date?: string | null
  separation_reason?: string | null
}

export interface EmployeeTaskItem {
  id: string
  title: string | null
  status: string | null
  created_at?: string | null
}

export interface EmployeeTaskAssignmentItem {
  id: string
  Task?: {
    id?: string | null
    title?: string | null
    status?: string | null
  } | null
}

export interface EmployeeAssetAssignmentItem {
  id: string
  assignmentType?: "office" | "personal" | null
  officeLocation?: string | null
  Asset?: {
    id?: string | null
    asset_name?: string | null
    asset_type?: string | null
    asset_model?: string | null
    unique_code?: string | null
    serial_number?: string | null
    status?: string | null
  } | null
}

export interface EmployeeProjectItem {
  id: string
  project_name: string | null
  status?: string | null
}

export interface EmployeeProjectMembershipItem {
  id: string
  Project?: {
    id?: string | null
    project_name?: string | null
  } | null
}

export interface EmployeeFeedbackItem {
  id: string
  title: string | null
  status: string | null
}

export interface EmployeeDocumentationItem {
  id: string
  title: string | null
  created_at?: string | null
}

export interface EmployeeAssignedItems {
  tasks: EmployeeTaskItem[]
  taskAssignments: EmployeeTaskAssignmentItem[]
  assets: EmployeeAssetAssignmentItem[]
  projects: EmployeeProjectItem[]
  projectMemberships: EmployeeProjectMembershipItem[]
  feedback: EmployeeFeedbackItem[]
  documentation: EmployeeDocumentationItem[]
}

export interface EmployeeViewData {
  tasks: EmployeeTaskItem[]
  assets: EmployeeAssetAssignmentItem[]
  documentation: EmployeeDocumentationItem[]
}

export interface EmployeeStatusSummary {
  id: string
  first_name: string
  last_name: string
  employment_status: EmploymentStatus
}
