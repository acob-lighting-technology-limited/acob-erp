import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"

export const HELP_DESK_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export const HELP_DESK_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "pending_approval",
  "approved_for_procurement",
  "rejected",
  "resolved",
  "closed",
  "cancelled",
] as const

export type HelpDeskPriority = (typeof HELP_DESK_PRIORITIES)[number]
export type HelpDeskStatus = (typeof HELP_DESK_STATUSES)[number]

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
  return role === "admin" || role === "super_admin"
}

export function isLeadRole(role?: string | null): boolean {
  return role === "lead"
}

export function canLeadDepartment(profile: any, department: string): boolean {
  if (isAdminRole(profile?.role)) return true
  if (!isLeadRole(profile?.role)) return false

  const managedDepartments = Array.isArray(profile?.managed_departments)
    ? profile.managed_departments
    : Array.isArray(profile?.lead_departments)
      ? profile.lead_departments
      : []
  return managedDepartments.includes(department) || profile?.department === department
}

export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, department, lead_departments, first_name, last_name, full_name")
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
}) {
  const supabase = await createClient()
  await supabase.from("audit_logs").insert({
    user_id: params.actorId,
    action: params.action,
    entity_type: "help_desk_ticket",
    entity_id: params.entityId,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  })
}
