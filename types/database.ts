export type UserRole = 'visitor' | 'staff' | 'lead' | 'admin' | 'super_admin'

export type DeviceStatus = 'available' | 'assigned' | 'maintenance' | 'retired'

export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'retired'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export type ProjectMemberRole = 'member' | 'lead' | 'manager'

export type ProjectItemStatus = 'pending' | 'ordered' | 'received' | 'installed'

export interface Profile {
  id: string
  company_email: string
  first_name: string
  last_name: string
  other_names?: string
  department: string
  company_role?: string
  phone_number?: string
  additional_phone?: string
  residential_address?: string
  current_work_location?: string
  site_name?: string
  site_state?: string
  is_admin: boolean
  role: UserRole
  is_department_lead: boolean
  lead_departments: string[]
  job_description?: string
  job_description_updated_at?: string
  created_at: string
  updated_at: string
}

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
  update_type: 'comment' | 'status_change' | 'progress_update'
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
  update_type: 'comment' | 'status_change' | 'milestone' | 'member_added' | 'member_removed'
  content?: string
  old_value?: string
  new_value?: string
  created_at: string
}
