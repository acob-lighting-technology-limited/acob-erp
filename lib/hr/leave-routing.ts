import { notifyUsers } from "@/lib/hr/leave-workflow"

type SupabaseClient = any

export const REQUESTER_KINDS = ["employee", "dept_lead", "admin_hr_lead", "hcs", "md"] as const
export type RequesterKind = (typeof REQUESTER_KINDS)[number]

export interface ResolvedRouteStage {
  stage_order: number
  approver_role_code: string
  approver_user_id: string
  stage_code: string
}

const DEPARTMENT_NAMES = {
  adminHr: "Admin & HR",
  md: "Executive Management",
  hcs: "Corporate Services",
} as const

function hasLeadForDepartment(profile: any, departmentName: string) {
  if (!profile) return false
  const managed = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return Boolean(
    profile.is_department_lead && (profile.department === departmentName || managed.includes(departmentName))
  )
}

export function stageCodeForRole(roleCode: string) {
  switch (roleCode) {
    case "reliever":
      return "pending_reliever"
    case "department_lead":
      return "pending_department_lead"
    case "admin_hr_lead":
      return "pending_admin_hr_lead"
    case "md":
      return "pending_md"
    case "hcs":
      return "pending_hcs"
    default:
      return `pending_${roleCode}`
  }
}

export function classifyRequesterKind(profile: any): RequesterKind {
  if (hasLeadForDepartment(profile, DEPARTMENT_NAMES.md)) return "md"
  if (hasLeadForDepartment(profile, DEPARTMENT_NAMES.hcs)) return "hcs"
  if (hasLeadForDepartment(profile, DEPARTMENT_NAMES.adminHr)) return "admin_hr_lead"
  if (profile?.is_department_lead) return "dept_lead"
  return "employee"
}

async function resolveProfileByDepartmentLead(
  supabase: SupabaseClient,
  departmentName: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, department, lead_departments, is_department_lead")
    .eq("is_department_lead", true)

  if (error) throw new Error(`Failed to resolve ${departmentName} lead`)

  const matches = (data || []).filter((profile: any) => hasLeadForDepartment(profile, departmentName))
  if (matches.length > 1) throw new Error(`LEAVE_APPROVER_CONFLICT:${departmentName}`)
  return matches[0] || null
}

async function resolveRequesterDepartmentLead(
  supabase: SupabaseClient,
  requester: { department_id?: string | null; department?: string | null }
): Promise<{ id: string } | null> {
  if (requester.department_id) {
    const { data: leadByDeptId, error: leadByDeptIdError } = await supabase
      .from("profiles")
      .select("id")
      .eq("department_id", requester.department_id)
      .eq("is_department_lead", true)
      .limit(2)

    if (leadByDeptIdError) throw new Error("Failed to resolve department lead")
    if ((leadByDeptId || []).length > 1) throw new Error("LEAVE_APPROVER_CONFLICT:department_lead")
    if ((leadByDeptId || []).length === 1) return leadByDeptId[0]
  }

  if (requester.department) {
    return resolveProfileByDepartmentLead(supabase, requester.department)
  }

  return null
}

async function resolveFixedRoleAssignee(supabase: SupabaseClient, roleCode: string): Promise<{ id: string } | null> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("leave_approver_assignments")
    .select("user_id, effective_from, effective_to, is_primary")
    .eq("approver_role_code", roleCode)
    .eq("is_active", true)
    .eq("scope_type", "global")
    .order("is_primary", { ascending: false })

  if (error) throw new Error(`Failed to resolve ${roleCode} assignment`)

  const valid = (data || []).filter((row: any) => {
    const startsOk = !row.effective_from || row.effective_from <= now
    const endsOk = !row.effective_to || row.effective_to >= now
    return startsOk && endsOk
  })

  if (valid.length > 1 && valid.filter((x: any) => x.is_primary).length > 1) {
    throw new Error(`LEAVE_APPROVER_CONFLICT:${roleCode}`)
  }

  return valid.length ? { id: valid[0].user_id } : null
}

async function resolveRoleApprover(
  supabase: SupabaseClient,
  roleCode: string,
  context: {
    requester: any
    relieverId: string
  }
): Promise<{ id: string } | null> {
  if (roleCode === "reliever") {
    return { id: context.relieverId }
  }

  if (roleCode === "department_lead") {
    return resolveRequesterDepartmentLead(supabase, context.requester)
  }

  if (roleCode === "admin_hr_lead") {
    return resolveProfileByDepartmentLead(supabase, DEPARTMENT_NAMES.adminHr)
  }

  if (roleCode === "md") {
    return resolveProfileByDepartmentLead(supabase, DEPARTMENT_NAMES.md)
  }

  if (roleCode === "hcs") {
    return resolveProfileByDepartmentLead(supabase, DEPARTMENT_NAMES.hcs)
  }

  return resolveFixedRoleAssignee(supabase, roleCode)
}

export async function loadRouteRows(supabase: SupabaseClient, requesterKind: RequesterKind) {
  const { data, error } = await supabase
    .from("leave_approval_role_routes")
    .select("stage_order, approver_role_code, is_active")
    .eq("requester_kind", requesterKind)
    .eq("is_active", true)
    .order("stage_order", { ascending: true })

  if (error) throw new Error("Failed to load leave route configuration")
  return data || []
}

export async function buildResolvedRouteSnapshot(params: {
  supabase: SupabaseClient
  requester: any
  requesterId: string
  requesterKind: RequesterKind
  relieverId: string
}) {
  const { supabase, requester, requesterId, requesterKind, relieverId } = params

  const routeRows = await loadRouteRows(supabase, requesterKind)
  if (!routeRows.length) {
    throw new Error(`LEAVE_APPROVER_NOT_CONFIGURED:route:${requesterKind}`)
  }

  const resolved: ResolvedRouteStage[] = []

  for (const row of routeRows) {
    const approver = await resolveRoleApprover(supabase, row.approver_role_code, {
      requester,
      relieverId,
    })

    if (!approver?.id) {
      throw new Error(`LEAVE_APPROVER_NOT_CONFIGURED:${row.approver_role_code}`)
    }

    if (approver.id === requesterId) {
      continue
    }

    const prev = resolved[resolved.length - 1]
    if (prev && prev.approver_user_id === approver.id) {
      continue
    }

    resolved.push({
      stage_order: resolved.length + 1,
      approver_role_code: row.approver_role_code,
      approver_user_id: approver.id,
      stage_code: stageCodeForRole(row.approver_role_code),
    })
  }

  if (!resolved.length) {
    throw new Error("LEAVE_APPROVER_NOT_CONFIGURED:empty_route")
  }

  return resolved
}

export function getRouteStageByOrder(snapshot: any, stageOrder: number): ResolvedRouteStage | null {
  if (!Array.isArray(snapshot)) return null
  return (
    snapshot
      .map((row) => ({
        stage_order: Number(row.stage_order),
        approver_role_code: String(row.approver_role_code),
        approver_user_id: String(row.approver_user_id),
        stage_code: String(row.stage_code),
      }))
      .find((row) => row.stage_order === stageOrder) || null
  )
}

export async function notifyStageApprover(params: {
  supabase: SupabaseClient
  approverUserId: string
  title: string
  message: string
  actorId: string
  entityId: string
  linkUrl?: string
}) {
  await notifyUsers(params.supabase, {
    userIds: [params.approverUserId],
    title: params.title,
    message: params.message,
    actorId: params.actorId,
    entityId: params.entityId,
    linkUrl: params.linkUrl || "/dashboard/leave",
  })
}
