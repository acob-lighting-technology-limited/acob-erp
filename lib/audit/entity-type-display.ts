/**
 * Maps raw entity_type / table_name values from audit_logs to human-readable
 * display category names.
 *
 * Single source of truth for the table view, Excel export, PDF export,
 * and Word export — update here, not in consumer files.
 */
export const ENTITY_TYPE_DISPLAY_MAP: Record<string, string> = {
  // Assets
  asset: "Assets",
  assets: "Assets",
  asset_assignment: "Assets",
  asset_assignments: "Assets",

  // Employees
  profile: "Employees",
  profiles: "Employees",
  user: "Employees",
  pending_user: "Employees",
  admin_action: "Employees",

  // Tasks
  task: "Tasks",
  tasks: "Tasks",
  task_assignment: "Tasks",
  task_assignments: "Tasks",

  // Projects
  project: "Projects",
  projects: "Projects",
  project_members: "Projects",
  project_updates: "Projects",

  // Finance
  department_payments: "Finance",
  payment_documents: "Finance",
  payment_categories: "Finance",
  starlink_payments: "Finance",

  // Leave / HR
  leave_requests: "Leave",
  leave_approvals: "Leave",
  leave_balances: "Leave",

  // Departments
  department: "Departments",
  departments: "Departments",

  // Feedback
  feedback: "Feedback",

  // Documentation
  documentation: "Documentation",
  user_documentation: "Documentation",

  // Devices (legacy)
  device: "Devices",
  devices: "Devices",
  device_assignment: "Devices",
  device_assignments: "Devices",

  // System / Management
  management: "System",
}

/**
 * Returns the human-readable display name for an entity type.
 * Falls back to title-casing the raw value split by underscores.
 */
export function getNormalizedEntityTypeDisplay(entityType: string): string {
  const key = (entityType || "unknown").toLowerCase()
  if (key in ENTITY_TYPE_DISPLAY_MAP) return ENTITY_TYPE_DISPLAY_MAP[key]

  // Default: split by underscore and title-case each word
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
