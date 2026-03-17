import type { UserRole } from "@/types/database"

export interface AdminDocumentation {
  id: string
  title: string
  content: string
  category: string | null
  tags: string[] | null
  is_draft: boolean
  created_at: string
  updated_at: string
  user_id: string
  user?: {
    first_name: string
    last_name: string
    company_email: string
    department: string
    role: UserRole
  }
}

export interface UserProfile {
  role: UserRole
  is_department_lead?: boolean
  lead_departments?: string[]
  managed_departments?: string[]
}

export interface employeeMember {
  id: string
  first_name: string
  last_name: string
  department: string
}
