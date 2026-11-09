import type { EmploymentStatus, UserRole } from "@/types/database"

export type EmployeeGender = "male" | "female" | "prefer_not_to_say" | "unspecified"

export interface Employee {
  id: string
  employee_number: string | null
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  additional_email: string | null
  personal_email: string | null
  department: string
  designation: string | null
  role: UserRole
  admin_routes?: string[] | null
  phone_number: string | null
  additional_phone: string | null
  gender?: EmployeeGender | null
  residential_address: string | null
  office_location: string | null
  device_key?: string | null
  date_of_birth: string | null
  birthday: string | null
  employment_date: string | null
  confirmation_date?: string | null
  separation_date?: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
  employment_status: EmploymentStatus
  employment_type?: "full_time" | "part_time" | "contract"
  contract_category_id?: string | null
  contract_categories?: { id: string; name: string; code: string } | null
  avatar_path?: string | null
  avatar_url?: string | null
  created_at: string
  mailbox_credentials_sent_at?: string | null
  /** cPanel mailbox provisioning outcome: "created" | "failed" | null (not attempted by Matrix) */
  mailbox_status?: string | null
  mailbox_error?: string | null
  nysc_cds_day?: string | null
}

export interface UserProfile {
  role: UserRole
  is_department_lead?: boolean
  managed_departments?: string[]
}
