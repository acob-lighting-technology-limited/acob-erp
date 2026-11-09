import type { SupabaseClient } from "@supabase/supabase-js"
import { expandDepartmentScopeForQuery } from "@/lib/admin/rbac"
import { loadAwayToday, type AwayTodayItem } from "@/lib/admin/away-today"
import { addIsoDays } from "@/lib/hr/leave-days"
import { logger } from "@/lib/logger"
import { taskDeadline } from "@/lib/tasks/overdue"
import { toLocalISODate } from "@/lib/utils/date"
import { buildRecentActivity, collapseRecentActivity } from "@/components/admin/dashboard-helpers"
import type { ActionQueueItem, RecentActivityItem } from "@/components/admin/dashboard-types"

/**
 * Data for the dashboard that /admin and /dept/[dept_id] both render.
 *
 * The two pages used to carry their own copies of these queries and drifted apart. Both now call this with
 * an already-resolved scope; it never resolves access itself.
 */

const log = logger("dashboard-data")

type ProfileIdRow = { id: string }
type DepartmentIdRow = { id: string }
type OpenTaskRow = { id: string; status: string; due_date: string | null; task_end_date: string | null }
type LeaveQueueRow = {
  id: string
  current_approver_user_id: string | null
  reliever_id: string | null
  current_stage_code: string | null
  approval_stage: string | null
}
type ActivityActorRow = {
  id: string
  first_name?: string | null
  last_name?: string | null
  company_email?: string | null
}
type ActivityLogRow = {
  id: string
  user_id: string | null
  created_at: string
  action?: string | null
  operation?: string | null
  entity_type?: string | null
  table_name?: string | null
  entity_id?: string | null
  department?: string | null
  metadata?: Record<string, unknown> | null
  changed_fields?: unknown
  new_values?: Record<string, unknown> | null
  old_values?: Record<string, unknown> | null
}

/** Statuses where a task is still live; matches `OPEN_TASK_STATUSES` on the profile. */
const OPEN_TASK_STATUSES = ["pending", "in_progress", "submitted_for_review", "unable_to_complete"]
/** Only these can be overdue: submitted and blocked work is with the lead (see `isTaskEscalated`). */
const WORKABLE_TASK_STATUSES = new Set(["pending", "in_progress"])
const PENDING_LEAVE_STATUSES = ["pending", "pending_evidence"]
const TERMINAL_TICKET_STATUSES = "(resolved,closed,cancelled,rejected)"
/** A recurring payment sits on "due" permanently, so only the next week counts as due. */
export const PAYMENT_DUE_WINDOW_DAYS = 7

export interface DashboardDataOptions {
  dataClient: SupabaseClient
  userId: string
  /**
   * Department names the viewer is limited to. `null` means unrestricted; an empty array means "nothing",
   * so a missing scope can never be mistaken for unrestricted.
   */
  departmentScope: string[] | null
  /** Whether the viewer may see the audit-log "Recent Activity" feed. */
  canSeeAuditActivity: boolean
}

export interface DashboardData {
  firstName: string | null
  todayIso: string
  clockedInCount: number
  activeStaffCount: number
  pendingLeaveCount: number
  openTaskCount: number
  overdueTaskCount: number
  recentActivity: RecentActivityItem[]
  awayToday: AwayTodayItem[]
  /** Every candidate row, hrefs in the `/admin/…` form; the view rewrites and filters them per shell. */
  actionQueue: ActionQueueItem[]
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`

export async function loadDashboardData({
  dataClient,
  userId,
  departmentScope,
  canSeeAuditActivity,
}: DashboardDataOptions): Promise<DashboardData> {
  const queryDepartmentScope = departmentScope ? expandDepartmentScopeForQuery(departmentScope) : null
  const profileIdsInScope = departmentScope
    ? (queryDepartmentScope && queryDepartmentScope.length > 0
        ? await dataClient
            .from("profiles")
            .select("id")
            .in("department", queryDepartmentScope)
            .returns<ProfileIdRow[]>()
        : { data: [] as ProfileIdRow[] }
      ).data || []
    : null
  const scopedUserIds = profileIdsInScope ? profileIdsInScope.map((profileRow) => profileRow.id) : []

  const { data: profile } = await dataClient.from("profiles").select("first_name").eq("id", userId).single()

  const todayIso = toLocalISODate()
  const departments = queryDepartmentScope || []
  const hasDepartments = departments.length > 0

  // Every count is live. All-time totals only grow and say nothing about today.
  let activeStaffQ = dataClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("employment_status", "active")
  let clockedInQ = dataClient
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("date", todayIso)
    .not("clock_in", "is", null)
  // `.neq` alone drops rows whose category is null, so the null case is spelled out.
  let openTasksQ = dataClient
    .from("tasks")
    .select("id, status, due_date, task_end_date")
    .in("status", OPEN_TASK_STATUSES)
    .or("category.is.null,category.neq.weekly_action")
  let pendingLeaveQ = dataClient
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .in("status", PENDING_LEAVE_STATUSES)
  let pendingUsersQ = dataClient
    .from("pending_users")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
  let openTicketsQ = dataClient
    .from("help_desk_tickets")
    .select("id", { count: "exact", head: true })
    .not("status", "in", TERMINAL_TICKET_STATUSES)
  let openFeedbackQ = dataClient.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open")
  // Requisitions move through role-based stages, so this is the pipeline in
  // scope rather than "awaiting you"; the requisitions page shows each stage.
  let pendingAppealsQ = dataClient
    .from("attendance_appeals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
  let ticketApprovalsQ = dataClient
    .from("help_desk_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_approval")
  let pendingRequisitionsQ = dataClient
    .from("requisitions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
  let paymentsDueQ = dataClient
    .from("department_payments")
    .select("id", { count: "exact", head: true })
    .or(`status.eq.overdue,and(status.eq.due,next_payment_due.lte.${addIsoDays(todayIso, PAYMENT_DUE_WINDOW_DAYS)})`)

  if (departmentScope) {
    activeStaffQ = hasDepartments ? activeStaffQ.in("department", departments) : activeStaffQ.eq("id", "__none__")
    openTasksQ = hasDepartments ? openTasksQ.in("department", departments) : openTasksQ.eq("id", "__none__")
    pendingUsersQ = hasDepartments ? pendingUsersQ.in("department", departments) : pendingUsersQ.eq("id", "__none__")
    openTicketsQ = hasDepartments
      ? openTicketsQ.in("service_department", departments)
      : openTicketsQ.eq("id", "__none__")
    clockedInQ = scopedUserIds.length > 0 ? clockedInQ.in("user_id", scopedUserIds) : clockedInQ.eq("id", "__none__")
    pendingLeaveQ =
      scopedUserIds.length > 0 ? pendingLeaveQ.in("user_id", scopedUserIds) : pendingLeaveQ.eq("id", "__none__")
    openFeedbackQ =
      scopedUserIds.length > 0 ? openFeedbackQ.in("user_id", scopedUserIds) : openFeedbackQ.eq("id", "__none__")
    pendingAppealsQ =
      scopedUserIds.length > 0 ? pendingAppealsQ.in("user_id", scopedUserIds) : pendingAppealsQ.eq("id", "__none__")
    ticketApprovalsQ = hasDepartments
      ? ticketApprovalsQ.in("service_department", departments)
      : ticketApprovalsQ.eq("id", "__none__")
    pendingRequisitionsQ = hasDepartments
      ? pendingRequisitionsQ.in("department", departments)
      : pendingRequisitionsQ.eq("id", "__none__")
    // department_payments is keyed by department id, not name.
    const scopedDepartmentIds = hasDepartments
      ? (
          (await dataClient.from("departments").select("id").in("name", departments).returns<DepartmentIdRow[]>())
            .data || []
        ).map((department) => department.id)
      : []
    paymentsDueQ =
      scopedDepartmentIds.length > 0
        ? paymentsDueQ.in("department_id", scopedDepartmentIds)
        : paymentsDueQ.eq("id", "__none__")
  }

  // Leave waiting on *this* user, by the same rule as the approval queue API
  // (/api/hr/leave/queue): they are the current approver, or the reliever while
  // the request sits at the reliever stage.
  const myLeaveQueueQ = dataClient
    .from("leave_requests")
    .select("id, current_approver_user_id, reliever_id, current_stage_code, approval_stage")
    .in("status", PENDING_LEAVE_STATUSES)
    .or(`current_approver_user_id.eq.${userId},reliever_id.eq.${userId}`)
    .returns<LeaveQueueRow[]>()

  const [
    activeStaff,
    clockedIn,
    openTasks,
    pendingLeave,
    pendingUsers,
    openTickets,
    openFeedback,
    myLeaveQueue,
    pendingRequisitions,
    paymentsDue,
    awayToday,
    pendingAppeals,
    ticketApprovals,
  ] = await Promise.all([
    activeStaffQ,
    clockedInQ,
    openTasksQ.returns<OpenTaskRow[]>(),
    pendingLeaveQ,
    pendingUsersQ,
    openTicketsQ,
    openFeedbackQ,
    myLeaveQueueQ,
    pendingRequisitionsQ,
    paymentsDueQ,
    loadAwayToday(dataClient, todayIso, departmentScope ? scopedUserIds : null),
    pendingAppealsQ,
    ticketApprovalsQ,
  ])

  if (activeStaff.error) log.error("active staff count failed", activeStaff.error)
  if (clockedIn.error) log.error("clocked-in count failed", clockedIn.error)
  if (openTasks.error) log.error("open tasks query failed", openTasks.error)
  if (pendingLeave.error) log.error("pending leave count failed", pendingLeave.error)
  if (pendingUsers.error) log.error("pending users count failed", pendingUsers.error)
  if (openTickets.error) log.error("open tickets count failed", openTickets.error)
  if (openFeedback.error) log.error("open feedback count failed", openFeedback.error)
  if (myLeaveQueue.error) log.error("leave approval queue query failed", myLeaveQueue.error)
  if (pendingRequisitions.error) log.error("pending requisitions count failed", pendingRequisitions.error)
  if (paymentsDue.error) log.error("payments due count failed", paymentsDue.error)
  if (pendingAppeals.error) log.error("pending appeals count failed", pendingAppeals.error)
  if (ticketApprovals.error) log.error("ticket approvals count failed", ticketApprovals.error)

  const openTaskRows = openTasks.data || []
  const overdueTaskCount = openTaskRows.filter((task) => {
    if (!WORKABLE_TASK_STATUSES.has(task.status)) return false
    const deadline = taskDeadline(task)
    return Boolean(deadline && deadline < todayIso)
  }).length
  const awaitingReviewCount = openTaskRows.filter((task) => task.status === "submitted_for_review").length
  const blockedTaskCount = openTaskRows.filter((task) => task.status === "unable_to_complete").length

  const myLeaveApprovals = (myLeaveQueue.data || []).filter((row) => {
    if (row.current_approver_user_id === userId) return true
    const stage = String(row.current_stage_code || row.approval_stage || "").toLowerCase()
    return row.reliever_id === userId && (stage === "pending_reliever" || stage === "reliever_pending")
  }).length

  const recentActivity = canSeeAuditActivity
    ? await loadRecentActivity(dataClient, queryDepartmentScope, scopedUserIds)
    : []

  const pendingLeaveCount = pendingLeave.count || 0
  const actionQueue: ActionQueueItem[] = [
    // Approvals first: they are the items only a lead or admin can unblock.
    {
      id: "leave-approvals",
      group: "approvals",
      tone: "attention",
      title: "Leave awaiting your approval",
      description: `${plural(myLeaveApprovals, "request")} at your approval or reliever stage`,
      count: myLeaveApprovals,
      href: "/admin/hr/leave",
    },
    {
      id: "leave-pending",
      group: "approvals",
      tone: "attention",
      title: "Leave requests pending",
      description: "Every undecided request in your scope, at any stage",
      count: pendingLeaveCount,
      href: "/admin/hr/leave",
    },
    {
      id: "attendance-appeals",
      group: "approvals",
      tone: "attention",
      title: "Attendance appeals",
      description: "Staff asking for an attendance status to be corrected",
      count: pendingAppeals.count || 0,
      href: "/admin/hr/attendance?tab=appeals",
    },
    {
      id: "ticket-approvals",
      group: "approvals",
      tone: "attention",
      title: "Help desk tickets awaiting approval",
      description: "Requests that need sign-off before work starts",
      count: ticketApprovals.count || 0,
      href: "/admin/help-desk/management",
    },
    {
      id: "pending-requisitions",
      group: "approvals",
      tone: "attention",
      title: "Requisitions in approval",
      description: "Pending at review, authorization or verification",
      count: pendingRequisitions.count || 0,
      href: "/admin/accounts/requisitions",
    },
    {
      id: "pending-users",
      group: "approvals",
      tone: "attention",
      title: "New users awaiting approval",
      description: "Sign-ups waiting to be approved or rejected",
      count: pendingUsers.count || 0,
      href: "/admin/hr/employees",
    },
    {
      id: "tasks-awaiting-review",
      group: "approvals",
      tone: "attention",
      title: "Tasks awaiting review",
      description: "Submitted by staff and waiting on a reviewer",
      count: awaitingReviewCount,
      href: "/admin/tasks",
    },
    // Then work that is late or stuck.
    {
      id: "overdue-tasks",
      group: "attention",
      tone: "critical",
      title: "Overdue tasks",
      description: "Pending or in progress past their deadline",
      count: overdueTaskCount,
      href: "/admin/tasks",
    },
    {
      id: "payments-due",
      group: "attention",
      tone: "critical",
      title: "Payments overdue or due this week",
      description: `Overdue, or due within ${PAYMENT_DUE_WINDOW_DAYS} days`,
      count: paymentsDue.count || 0,
      href: "/admin/accounts/payments",
    },
    {
      id: "blocked-tasks",
      group: "attention",
      tone: "attention",
      title: "Tasks reported blocked",
      description: "Unable to complete: extend, reassign or cancel",
      count: blockedTaskCount,
      href: "/admin/tasks",
    },
    {
      id: "open-tickets",
      group: "attention",
      tone: "info",
      title: "Open help desk tickets",
      description: "Not yet resolved, closed or cancelled",
      count: openTickets.count || 0,
      href: "/admin/help-desk/management",
    },
    {
      id: "open-feedback",
      group: "attention",
      tone: "info",
      title: "Open feedback",
      description: "Staff feedback not yet responded to",
      count: openFeedback.count || 0,
      href: "/admin/feedback",
    },
  ]

  return {
    firstName: (profile as { first_name?: string | null } | null)?.first_name ?? null,
    todayIso,
    clockedInCount: clockedIn.count || 0,
    activeStaffCount: activeStaff.count || 0,
    pendingLeaveCount,
    openTaskCount: openTaskRows.length,
    overdueTaskCount,
    recentActivity,
    awayToday,
    actionQueue,
  }
}

async function loadRecentActivity(
  dataClient: SupabaseClient,
  queryDepartmentScope: string[] | null,
  scopedUserIds: string[]
): Promise<RecentActivityItem[]> {
  const activitySelect =
    "id, user_id, created_at, action, operation, entity_type, table_name, entity_id, department, metadata, changed_fields, new_values, old_values"
  const base = () =>
    dataClient
      .from("audit_logs")
      .select(activitySelect)
      .neq("action", "client_error")
      .neq("entity_type", "ui_runtime")
      .neq("entity_type", "system_runtime")

  let rawActivity: ActivityLogRow[] = []
  if (queryDepartmentScope) {
    if (queryDepartmentScope.length > 0) {
      const [departmentActivity, userActivity] = await Promise.all([
        base()
          .in("department", queryDepartmentScope)
          .order("created_at", { ascending: false })
          .limit(50)
          .returns<ActivityLogRow[]>(),
        scopedUserIds.length > 0
          ? base()
              .in("user_id", scopedUserIds)
              .order("created_at", { ascending: false })
              .limit(50)
              .returns<ActivityLogRow[]>()
          : Promise.resolve({ data: [] as ActivityLogRow[], error: null }),
      ])
      if (departmentActivity.error) log.error("Recent activity department query failed", departmentActivity.error)
      if (userActivity.error) log.error("Recent activity user query failed", userActivity.error)

      const activityById = new Map<string, ActivityLogRow>()
      for (const item of [...(departmentActivity.data || []), ...(userActivity.data || [])]) {
        activityById.set(item.id, item)
      }
      rawActivity = Array.from(activityById.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }
  } else {
    const { data, error } = await base().order("created_at", { ascending: false }).limit(50).returns<ActivityLogRow[]>()
    if (error) log.error("Recent activity query failed", error)
    rawActivity = data || []
  }

  const collapsedActivity = collapseRecentActivity(rawActivity, 8)
  const actorIds = Array.from(new Set(collapsedActivity.map(({ row }) => row.user_id).filter(Boolean))) as string[]
  let actorMap = new Map<string, { first_name?: string; last_name?: string; company_email?: string }>()
  if (actorIds.length > 0) {
    const { data: actorProfiles } = await dataClient
      .from("profiles")
      .select("id, first_name, last_name, company_email")
      .in("id", actorIds)
      .returns<ActivityActorRow[]>()
    actorMap = new Map(
      (actorProfiles || []).map((actor) => [
        actor.id,
        {
          first_name: actor.first_name || undefined,
          last_name: actor.last_name || undefined,
          company_email: actor.company_email || undefined,
        },
      ])
    )
  }

  return buildRecentActivity(collapsedActivity, actorMap)
}
