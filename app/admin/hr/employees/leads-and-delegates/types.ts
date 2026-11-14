export interface DepartmentLead {
  id: string
  name: string
  lead_id: string | null
  lead_name: string | null
  lead_email: string | null
}

export interface LeadDirectory {
  departments: DepartmentLead[]
  candidates: { id: string; first_name: string | null; last_name: string | null; department: string | null }[]
  canEdit: boolean
}

export interface Delegation {
  id: string
  department_id: string
  delegate_id: string
  delegate: string
  lead: string
  department: string
  created_at: string
  valid_until: string
  revoked_at: string | null
  pages: string[]
  adminRoutes: string[]
}

export type Editor = { type: "lead"; department: DepartmentLead } | { type: "delegate"; delegation?: Delegation }
