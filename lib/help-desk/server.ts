import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { writeAuditLog } from "@/lib/audit/write-audit"

export const HELP_DESK_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export const HELP_DESK_STATUSES = [
  "new",
  "pending_lead_review",
  "department_queue",
  "department_assigned",
  "assigned",
  "in_progress",
  "pending_approval",
  "approved_for_procurement",
  "rejected",
  "returned",
  "resolved",
  "closed",
  "cancelled",
] as const

export const HELP_DESK_SUPPORT_MODES = ["open_queue", "lead_review_required"] as const
export const HELP_DESK_HANDLING_MODES = ["individual", "queue", "department"] as const

export type HelpDeskPriority = (typeof HELP_DESK_PRIORITIES)[number]
export type HelpDeskStatus = (typeof HELP_DESK_STATUSES)[number]
export type HelpDeskSupportMode = (typeof HELP_DESK_SUPPORT_MODES)[number]
export type HelpDeskHandlingMode = (typeof HELP_DESK_HANDLING_MODES)[number]

export function addBusinessHours(baseDate: Date, hours: number): Date {
  const date = new Date(baseDate)
  let remainingHours = hours

  while (remainingHours > 0) {
    date.setHours(date.getHours() + 1)
    const day = date.getDay() // 0 Sun, 6 Sat
    if (day === 0 || day === 6) continue

    const hour = date.getHours()
    if (hour >= 9 && hour < 18) {
      remainingHours -= 1
    }
  }

  return date
}

export function addBusinessDays(baseDate: Date, days: number): Date {
  const date = new Date(baseDate)
  let remaining = days

  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) {
      remaining -= 1
    }
  }

  return date
}

export function getSlaTarget(priority: HelpDeskPriority, submittedAt: Date): Date {
  if (priority === "urgent") return addBusinessHours(submittedAt, 4)
  if (priority === "high") return addBusinessHours(submittedAt, 24)
  if (priority === "medium") return addBusinessDays(submittedAt, 3)
  return addBusinessDays(submittedAt, 7)
}

export function isAdminRole(role?: string | null): boolean {
  return role === "developer" || role === "admin" || role === "super_admin"
}

export function isLeadRole(profile?: { is_department_lead?: boolean } | null): boolean {
  return Boolean(profile?.is_department_lead)
}

export function canLeadDepartment(profile: any, department: string): boolean {
  if (isAdminRole(profile?.role)) return true
  if (!profile?.is_department_lead) return false

  const managedDepartments = Array.isArray(profile?.managed_departments)
    ? profile.managed_departments
    : Array.isArray(profile?.lead_departments)
      ? profile.lead_departments
      : []
  return managedDepartments.includes(department) || profile?.department === department
}

export function canWorkDepartment(profile: any, department: string): boolean {
  return isAdminRole(profile?.role) || profile?.department === department || canLeadDepartment(profile, department)
}

export function resolveLeadForDepartment<
  T extends { is_department_lead?: boolean; department?: string | null; lead_departments?: string[] | null },
>(profiles: T[], department: string | null | undefined): T | null {
  if (!department) return null
  return (
    profiles.find((profile) => {
      if (!profile?.is_department_lead) return false
      const managedDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
      return profile.department === department || managedDepartments.includes(department)
    }) || null
  )
}

export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, department, is_department_lead, lead_departments, first_name, last_name, full_name")
    .eq("id", user.id)
    .single()
  const scope = await resolveAdminScope(supabase as any, user.id)
  const managedDepartments = scope?.managedDepartments ?? []

  return {
    supabase,
    user,
    profile: profile
      ? {
          ...profile,
          managed_departments: managedDepartments,
        }
      : null,
  }
}

export async function appendHelpDeskEvent(params: {
  ticketId: string
  actorId: string
  eventType: string
  oldStatus?: string | null
  newStatus?: string | null
  details?: Record<string, unknown>
}) {
  const supabase = await createClient()
  await supabase.from("help_desk_events").insert({
    ticket_id: params.ticketId,
    actor_id: params.actorId,
    event_type: params.eventType,
    old_status: params.oldStatus ?? null,
    new_status: params.newStatus ?? null,
    details: params.details ?? null,
  })
}

export async function appendAuditLog(params: {
  actorId: string
  action: string
  entityId: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  department?: string | null
  route?: string
  critical?: boolean
}) {
  const supabase = await createClient()
  await writeAuditLog(
    supabase as any,
    {
      action: params.action,
      entityType: "help_desk_ticket",
      entityId: params.entityId,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      context: {
        actorId: params.actorId,
        department: params.department ?? null,
        source: "api",
        route: params.route ?? "/api/help-desk",
      },
    },
    {
      critical: params.critical,
    }
  )
}
