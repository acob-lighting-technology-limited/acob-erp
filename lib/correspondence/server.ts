import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import type { CorrespondenceRecord, CorrespondenceStatus } from "@/types/correspondence"

export const CORRESPONDENCE_STATUSES: CorrespondenceStatus[] = [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "returned_for_correction",
  "sent",
  "filed",
  "assigned_action_pending",
  "open",
  "closed",
  "cancelled",
]

export function isAdminRole(role?: string | null): boolean {
  return role === "admin" || role === "super_admin"
}

export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, profile: null }

  const [{ data: profile }, scope] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, department, lead_departments, first_name, last_name, full_name")
      .eq("id", user.id)
      .single(),
    resolveAdminScope(supabase as any, user.id),
  ])

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

export function canAccessDepartment(profile: any, department?: string | null): boolean {
  if (!department) return false
  if (isAdminRole(profile?.role)) return true
  if (profile?.role !== "lead") return false

  const managedDepartments = Array.isArray(profile?.managed_departments)
    ? profile.managed_departments
    : Array.isArray(profile?.lead_departments)
      ? profile.lead_departments
      : []

  return managedDepartments.includes(department) || profile?.department === department
}

export function canAccessRecord(profile: any, userId: string, record: Partial<CorrespondenceRecord>): boolean {
  if (isAdminRole(profile?.role)) return true
  if (record.originator_id === userId) return true
  if (record.responsible_officer_id === userId) return true

  return (
    canAccessDepartment(profile, record.department_name ?? null) ||
    canAccessDepartment(profile, record.assigned_department_name ?? null)
  )
}

export async function appendCorrespondenceEvent(params: {
  correspondenceId: string
  actorId: string
  eventType: string
  oldStatus?: string | null
  newStatus?: string | null
  details?: Record<string, unknown>
}) {
  const supabase = await createClient()
  await supabase.from("correspondence_events").insert({
    correspondence_id: params.correspondenceId,
    actor_id: params.actorId,
    event_type: params.eventType,
    old_status: params.oldStatus ?? null,
    new_status: params.newStatus ?? null,
    details: params.details ?? null,
  })
}

export async function appendCorrespondenceAuditLog(params: {
  actorId: string
  action: string
  recordId: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
}) {
  const supabase = await createClient()
  await supabase.from("audit_logs").insert({
    user_id: params.actorId,
    action: params.action,
    entity_type: "correspondence_record",
    entity_id: params.recordId,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  })
}

export async function getDepartmentCodeByName(departmentName: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("correspondence_department_codes")
    .select("department_code")
    .eq("department_name", departmentName)
    .eq("is_active", true)
    .single()

  if (error || !data) return null
  return data.department_code
}
