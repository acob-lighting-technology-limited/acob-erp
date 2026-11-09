/**
 * Help Desk Standalone Permissions Module
 *
 * Single source of truth for Help Desk access control and lifecycle actions.
 * Used by API routes and frontend UI components.
 * Pure functions only — no server-only dependencies or database calls.
 */

export interface HelpDeskUserContext {
  id?: string
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
  managed_departments?: string[] | null
}

export interface HelpDeskTicketContext {
  id: string
  requester_id?: string | null
  requester_department?: string | null
  assigned_to?: string | null
  service_department: string | null
  status: string
}

export const OPEN_HELP_DESK_STATUSES = new Set([
  "new",
  "pending_lead_review",
  "department_queue",
  "department_assigned",
  "assigned",
  "in_progress",
  "paused",
])

export const TERMINAL_HELP_DESK_STATUSES = new Set(["resolved", "closed", "cancelled", "rejected", "converted"])

export function isAdminRole(role?: string | null): boolean {
  return role === "developer" || role === "admin" || role === "super_admin"
}

export function isLeadRole(profile?: { is_department_lead?: boolean | null } | null): boolean {
  return Boolean(profile?.is_department_lead)
}

/**
 * Department-lead membership check — no admin bypass.
 */
export function canLeadDepartment(
  profile: HelpDeskUserContext | null | undefined,
  department: string | null | undefined
): boolean {
  if (!profile?.is_department_lead || !department) return false

  const managed = Array.isArray(profile.managed_departments)
    ? profile.managed_departments
    : Array.isArray(profile.lead_departments)
      ? profile.lead_departments
      : []

  return managed.includes(department) || profile.department === department
}

/**
 * Department worker or lead check — no admin bypass.
 */
export function canWorkDepartment(
  profile: HelpDeskUserContext | null | undefined,
  department: string | null | undefined
): boolean {
  if (!department) return false
  return profile?.department === department || canLeadDepartment(profile, department)
}

/**
 * Whether the user is the service department lead for this ticket (or global admin).
 */
export function isServiceLeadOrAdmin(
  user: HelpDeskUserContext | null | undefined,
  ticket: HelpDeskTicketContext
): boolean {
  if (!user) return false
  if (isAdminRole(user.role)) return true
  if (!ticket.service_department) return false
  return canLeadDepartment(user, ticket.service_department)
}

/**
 * Whether the user can view the ticket details and comments.
 */
export function canViewTicket(user: HelpDeskUserContext | null | undefined, ticket: HelpDeskTicketContext): boolean {
  if (!user) return false
  if (isAdminRole(user.role)) return true
  if (user.id === ticket.requester_id) return true
  if (ticket.assigned_to && user.id === ticket.assigned_to) return true
  if (ticket.service_department && canWorkDepartment(user, ticket.service_department)) return true
  if (ticket.requester_department && canLeadDepartment(user, ticket.requester_department)) return true
  return false
}

/**
 * Accept to queue / assign / reassign ticket.
 * Allowed for: receiving department lead and global admin.
 * Allowed from: any open status (not terminal).
 */
export function canReassignTicket(
  user: HelpDeskUserContext | null | undefined,
  ticket: HelpDeskTicketContext
): boolean {
  if (!user) return false
  if (TERMINAL_HELP_DESK_STATUSES.has(ticket.status)) return false
  return isServiceLeadOrAdmin(user, ticket)
}

export const canAcceptTicket = canReassignTicket

/**
 * Start work on ticket (transition to 'in_progress').
 * Allowed for: Assignee, receiving lead, global admin.
 * Valid current statuses: 'assigned', 'paused'.
 */
export function canStartWork(user: HelpDeskUserContext | null | undefined, ticket: HelpDeskTicketContext): boolean {
  if (!user) return false
  if (ticket.status !== "assigned" && ticket.status !== "paused") return false
  const isAssignee = Boolean(ticket.assigned_to && user.id === ticket.assigned_to)
  return isAssignee || isServiceLeadOrAdmin(user, ticket)
}

/**
 * Pause work on ticket (transition to 'paused').
 * Allowed for: Assignee, receiving lead, global admin.
 * Valid current status: 'in_progress'.
 */
export function canPauseWork(user: HelpDeskUserContext | null | undefined, ticket: HelpDeskTicketContext): boolean {
  if (!user) return false
  if (ticket.status !== "in_progress") return false
  const isAssignee = Boolean(ticket.assigned_to && user.id === ticket.assigned_to)
  return isAssignee || isServiceLeadOrAdmin(user, ticket)
}

/**
 * Mark ticket resolved (transition to 'resolved').
 * Allowed for: Assignee, receiving lead, global admin.
 * Valid current statuses: 'assigned', 'in_progress', 'paused'.
 */
export function canResolveTicket(user: HelpDeskUserContext | null | undefined, ticket: HelpDeskTicketContext): boolean {
  if (!user) return false
  if (!["assigned", "in_progress", "paused"].includes(ticket.status)) return false
  const isAssignee = Boolean(ticket.assigned_to && user.id === ticket.assigned_to)
  return isAssignee || isServiceLeadOrAdmin(user, ticket)
}

/**
 * Close ticket with 1-5 service rating (transition to 'closed').
 * Allowed for: Requester, receiving lead, global admin.
 * FORBIDDEN: The assignee can NEVER close/rate their own ticket.
 * Valid current status: 'resolved'.
 */
export function canCloseTicket(user: HelpDeskUserContext | null | undefined, ticket: HelpDeskTicketContext): boolean {
  if (!user) return false
  if (ticket.status !== "resolved") return false

  // Strict: Assignee can NEVER close or rate their own ticket, even if they are lead or admin
  if (ticket.assigned_to && user.id === ticket.assigned_to) {
    return false
  }

  const isRequester = user.id === ticket.requester_id
  return isRequester || isServiceLeadOrAdmin(user, ticket)
}

/**
 * Convert ticket to task.
 * Allowed for: Receiving lead, global admin.
 * Valid current statuses: any open status.
 */
export function canConvertToTask(user: HelpDeskUserContext | null | undefined, ticket: HelpDeskTicketContext): boolean {
  if (!user) return false
  if (TERMINAL_HELP_DESK_STATUSES.has(ticket.status)) return false
  return isServiceLeadOrAdmin(user, ticket)
}

/**
 * Cancel ticket.
 * Allowed for:
 * - Requester: before work starts (statuses 'new', 'pending_lead_review', 'department_queue', 'department_assigned', 'assigned').
 * - Receiving lead / global admin: any open status before resolved/closed.
 */
export function canCancelTicket(user: HelpDeskUserContext | null | undefined, ticket: HelpDeskTicketContext): boolean {
  if (!user) return false
  if (TERMINAL_HELP_DESK_STATUSES.has(ticket.status)) return false

  if (isServiceLeadOrAdmin(user, ticket)) {
    return true
  }

  if (user.id === ticket.requester_id) {
    const beforeWorkStarts = ["new", "pending_lead_review", "department_queue", "department_assigned", "assigned"]
    return beforeWorkStarts.includes(ticket.status)
  }

  return false
}
