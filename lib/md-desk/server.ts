import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import type { EventsSession } from "@/lib/events/server"
import type { MdDeskDelegate, MdDeskQueue, MdDeskQueueItem } from "@/lib/md-desk/types"
import { isAdminLikeRole } from "@/lib/admin/rbac"
import { isLeadForTaskDepartment } from "@/lib/tasks/rating-authority"

const log = logger("md-desk")

type DirectoryRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
}

function displayName(row: DirectoryRow | undefined): string {
  if (!row) return "Unknown"
  return row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unknown"
}

export type MdDeskAccess = { isMember: boolean; canEdit: boolean; isMd: boolean; canManageDelegates: boolean }

/** Same database helpers the RLS policies use, so page gates and data rules agree. */
export async function loadMdDeskAccess(session: EventsSession): Promise<MdDeskAccess> {
  const { supabase } = session
  const [member, edit, md, admin] = await Promise.all([
    supabase.rpc("is_md_desk_member"),
    supabase.rpc("can_edit_md_desk"),
    supabase.rpc("is_md"),
    supabase.rpc("is_admin_like"),
  ])
  const isMd = md.data === true
  return {
    isMember: member.data === true,
    canEdit: edit.data === true,
    isMd,
    canManageDelegates: isMd || admin.data === true,
  }
}

async function resolveNames(session: EventsSession, ids: string[]): Promise<Map<string, DirectoryRow>> {
  const map = new Map<string, DirectoryRow>()
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (!unique.length) return map
  const { data, error } = await session.supabase
    .from("staff_directory")
    .select("id, full_name, first_name, last_name, department")
    .in("id", unique)
  if (error) log.warn({ err: error.message }, "Failed to resolve names")
  for (const row of (data ?? []) as DirectoryRow[]) map.set(row.id, row)
  return map
}

type SubmittedTaskRow = {
  id: string
  title: string | null
  work_item_number: string | null
  department: string | null
  assigned_to: string | null
  assigned_by: string | null
  project_id: string | null
  updated_at: string | null
  created_at: string
}

type ReviewerProfileRow = {
  id: string
  role: string | null
  department: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
}

/**
 * Submitted tasks a reviewer assigned to themselves. Nobody rates their own
 * task, and such a task has no other reviewer, so it waits on the MD. A
 * self-assigned task whose assignee is not a reviewer (e.g. a weekly-report
 * item an employee logged) still goes to their lead and is not listed here.
 */
async function loadSelfAssignedTasksAwaitingMd(db: SupabaseClient, mdId: string | null): Promise<SubmittedTaskRow[]> {
  const { data, error } = await db
    .from("tasks")
    .select("id, title, work_item_number, department, assigned_to, assigned_by, project_id, updated_at, created_at")
    .eq("status", "submitted_for_review")
    .eq("is_archived", false)
    .not("assigned_to", "is", null)
    .order("updated_at", { ascending: true })
  if (error) {
    log.error({ err: error.message }, "Failed to load MD task rating queue")
    return []
  }

  const selfAssigned = ((data ?? []) as SubmittedTaskRow[]).filter(
    (t) => t.assigned_to && t.assigned_to === t.assigned_by && t.assigned_to !== mdId
  )
  if (!selfAssigned.length) return []

  const assigneeIds = Array.from(new Set(selfAssigned.map((t) => t.assigned_to as string)))
  const projectIds = Array.from(new Set(selfAssigned.map((t) => t.project_id).filter(Boolean) as string[]))
  const [profilesRes, projectsRes] = await Promise.all([
    db.from("profiles").select("id, role, department, is_department_lead, lead_departments").in("id", assigneeIds),
    projectIds.length
      ? db.from("projects").select("id, project_manager_id").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (profilesRes.error) log.error({ err: profilesRes.error.message }, "Failed to load task assignee profiles")
  if (projectsRes.error) log.error({ err: projectsRes.error.message }, "Failed to load task projects")

  const profileById = new Map(((profilesRes.data ?? []) as ReviewerProfileRow[]).map((p) => [p.id, p]))
  const managerByProject = new Map(
    ((projectsRes.data ?? []) as { id: string; project_manager_id: string | null }[]).map((p) => [
      p.id,
      p.project_manager_id,
    ])
  )

  return selfAssigned.filter((t) => {
    const profile = profileById.get(t.assigned_to as string)
    if (isAdminLikeRole(profile?.role)) return true
    if (isLeadForTaskDepartment(profile, t.department)) return true
    return Boolean(t.project_id) && managerByProject.get(t.project_id as string) === t.assigned_to
  })
}

/**
 * Items currently waiting on the MD's decision across leave, requisitions,
 * correspondence and task ratings. Callers must check `isMember` first: this reads with the
 * service role because the underlying tables are scoped to the approver, and a
 * delegate (the PA) is not the approver. Only summary fields are returned — no
 * leave reasons, amounts-in-words or letter bodies.
 */
export async function loadWaitingOnMd(session: EventsSession): Promise<MdDeskQueue> {
  const db = getServiceRoleClientOrFallback(session.supabase)

  const { data: mdDept } = await db
    .from("departments")
    .select("department_head_id")
    .eq("department_code", "MD")
    .maybeSingle()
  const mdId = (mdDept?.department_head_id as string | null) ?? null

  const [leaveRes, reqRes, corrRes, selfTasks] = await Promise.all([
    mdId
      ? db
          .from("leave_requests")
          .select("id, user_id, start_date, end_date, days_count, created_at")
          .eq("status", "pending")
          .eq("current_approver_user_id", mdId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db
      .from("requisitions")
      .select("id, requisition_number, user_id, department, amount, purpose, is_emergency, created_at")
      .eq("status", "pending")
      .eq("current_stage_code", "pending_approved_by")
      .order("created_at", { ascending: true }),
    db
      .from("correspondence_approvals")
      .select("id, correspondence_id, requested_at, created_at")
      .eq("approval_stage", "exec_review")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    loadSelfAssignedTasksAwaitingMd(db, mdId),
  ])

  if (leaveRes.error) log.error({ err: leaveRes.error.message }, "Failed to load MD leave queue")
  if (reqRes.error) log.error({ err: reqRes.error.message }, "Failed to load MD requisition queue")
  if (corrRes.error) log.error({ err: corrRes.error.message }, "Failed to load MD correspondence queue")

  const leaves = (leaveRes.data ?? []) as {
    id: string
    user_id: string
    start_date: string
    end_date: string
    days_count: number | null
    created_at: string
  }[]
  const reqs = (reqRes.data ?? []) as {
    id: string
    requisition_number: string | null
    user_id: string
    department: string | null
    amount: number | null
    purpose: string | null
    is_emergency: boolean | null
    created_at: string
  }[]
  const approvals = (corrRes.data ?? []) as {
    id: string
    correspondence_id: string
    requested_at: string | null
    created_at: string
  }[]

  const corrIds = approvals.map((a) => a.correspondence_id)
  const { data: records } = corrIds.length
    ? await db
        .from("correspondence_records")
        .select("id, reference_number, subject, department_name, originator_id, status")
        .in("id", corrIds)
    : { data: [] }
  const recordById = new Map(
    (
      (records ?? []) as {
        id: string
        reference_number: string | null
        subject: string | null
        department_name: string | null
        originator_id: string | null
        status: string | null
      }[]
    ).map((r) => [r.id, r])
  )

  const names = await resolveNames(session, [
    ...leaves.map((l) => l.user_id),
    ...reqs.map((r) => r.user_id),
    ...[...recordById.values()].map((r) => r.originator_id || ""),
    ...selfTasks.map((t) => t.assigned_to || ""),
  ])

  const items: MdDeskQueueItem[] = [
    ...leaves.map((l) => ({
      id: `leave-${l.id}`,
      kind: "leave" as const,
      title: `Leave request · ${l.days_count ?? "?"} day${l.days_count === 1 ? "" : "s"}`,
      detail: `${l.start_date} to ${l.end_date}`,
      requester: displayName(names.get(l.user_id)),
      department: names.get(l.user_id)?.department ?? null,
      waiting_since: l.created_at,
      href: "/admin/hr/leave",
      urgent: false,
    })),
    ...reqs.map((r) => ({
      id: `requisition-${r.id}`,
      kind: "requisition" as const,
      title: `Requisition ${r.requisition_number ?? ""}`.trim(),
      detail: r.purpose ? r.purpose.slice(0, 140) : null,
      requester: displayName(names.get(r.user_id)),
      department: r.department,
      waiting_since: r.created_at,
      href: "/admin/accounts/requisitions",
      urgent: Boolean(r.is_emergency),
      amount: r.amount,
    })),
    ...approvals.flatMap((a) => {
      const record = recordById.get(a.correspondence_id)
      if (!record) return []
      return [
        {
          id: `correspondence-${a.id}`,
          kind: "correspondence" as const,
          title: record.subject || "Correspondence",
          detail: record.reference_number,
          requester: record.originator_id ? displayName(names.get(record.originator_id)) : "Unknown",
          department: record.department_name,
          waiting_since: a.requested_at || a.created_at,
          href: "/admin/correspondence",
          urgent: false,
        },
      ]
    }),
    ...selfTasks.map((t) => ({
      id: `task_rating-${t.id}`,
      kind: "task_rating" as const,
      title: `Rate task · ${t.title || "Untitled task"}`,
      detail: t.work_item_number,
      requester: displayName(names.get(t.assigned_to as string)),
      department: t.department,
      waiting_since: t.updated_at || t.created_at,
      href: "/admin/tasks",
      urgent: false,
    })),
  ].sort((x, y) => Number(y.urgent) - Number(x.urgent) || x.waiting_since.localeCompare(y.waiting_since))

  return {
    items,
    counts: {
      leave: leaves.length,
      requisition: reqs.length,
      correspondence: items.filter((i) => i.kind === "correspondence").length,
      task_rating: selfTasks.length,
    },
  }
}

export async function loadDelegates(session: EventsSession): Promise<MdDeskDelegate[]> {
  const { data, error } = await session.supabase
    .from("md_desk_delegates")
    .select("profile_id, can_edit, granted_by, created_at")
    .order("created_at", { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as {
    profile_id: string
    can_edit: boolean
    granted_by: string | null
    created_at: string
  }[]
  const names = await resolveNames(session, [...rows.map((r) => r.profile_id), ...rows.map((r) => r.granted_by || "")])
  return rows.map((r) => ({
    profile_id: r.profile_id,
    name: displayName(names.get(r.profile_id)),
    department: names.get(r.profile_id)?.department ?? null,
    can_edit: r.can_edit,
    granted_by_name: r.granted_by ? displayName(names.get(r.granted_by)) : null,
    created_at: r.created_at,
  }))
}
