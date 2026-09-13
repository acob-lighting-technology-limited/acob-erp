import "server-only"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import type { EventsSession } from "@/lib/events/server"
import type { MdDeskDelegate, MdDeskQueue, MdDeskQueueItem } from "@/lib/md-desk/types"

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

/**
 * Items currently waiting on the MD's decision across leave, requisitions and
 * correspondence. Callers must check `isMember` first: this reads with the
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

  const [leaveRes, reqRes, corrRes] = await Promise.all([
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
  ].sort((x, y) => Number(y.urgent) - Number(x.urgent) || x.waiting_since.localeCompare(y.waiting_since))

  return {
    items,
    counts: {
      leave: leaves.length,
      requisition: reqs.length,
      correspondence: items.filter((i) => i.kind === "correspondence").length,
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
