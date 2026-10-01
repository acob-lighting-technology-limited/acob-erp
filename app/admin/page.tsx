import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { expandDepartmentScopeForQuery, getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertTriangle, CalendarClock, ClipboardList, Clock, Shield, Stamp, Users } from "lucide-react"
import { formatName } from "@/lib/utils"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { RecentActivityFeed } from "@/components/admin/recent-activity-feed"
import { ActionQueue } from "@/components/admin/action-queue"
import { AwayToday } from "@/components/admin/away-today"
import { loadAwayToday } from "@/lib/admin/away-today"
import { addIsoDays } from "@/lib/hr/leave-days"
import type { ActionQueueItem } from "@/components/admin/dashboard-types"
import { buildRecentActivity, isExcludedActivity } from "@/components/admin/dashboard-helpers"
import { logger } from "@/lib/logger"
import { taskDeadline } from "@/lib/tasks/overdue"
import { toLocalISODate } from "@/lib/utils/date"
import { buildAccessContextV2, canAccessRouteV2, resolveAdminRouteKeyV2 } from "@/lib/admin/policy-v2"

const log = logger("")

type ProfileIdRow = {
  id: string
}

type DepartmentIdRow = {
  id: string
}

type OpenTaskRow = {
  id: string
  status: string
  due_date: string | null
  task_end_date: string | null
}

type LeaveQueueRow = {
  id: string
  current_approver_user_id: string | null
  reliever_id: string | null
  current_stage_code: string | null
  approval_stage: string | null
}

/** Statuses where a task is still live; matches `OPEN_TASK_STATUSES` on the profile. */
const OPEN_TASK_STATUSES = ["pending", "in_progress", "submitted_for_review", "unable_to_complete"]
/** Only these can be overdue: submitted and blocked work is with the lead (see `isTaskEscalated`). */
const WORKABLE_TASK_STATUSES = new Set(["pending", "in_progress"])
const PENDING_LEAVE_STATUSES = ["pending", "pending_evidence"]
const TERMINAL_TICKET_STATUSES = "(resolved,closed,cancelled,rejected)"
/** A recurring payment sits on "due" permanently, so only the next week counts as due. */
const PAYMENT_DUE_WINDOW_DAYS = 7

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

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const scope = user ? await resolveAdminScope(supabase, user.id) : null
  const departmentScope = scope ? getDepartmentScope(scope, "general") : null
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

  const { data: profile } = await dataClient.from("profiles").select("*").eq("id", user?.id).single()
  const canSeeAuditActivity = Boolean(scope?.isAdminLike || scope?.isDepartmentLead)

  const todayIso = toLocalISODate()
  const departments = queryDepartmentScope || []
  const hasDepartments = departments.length > 0

  // The KPI row used to show all-time totals: every task ever created under
  // "Active Tasks", every profile including leavers, documents, feedback.
  // Numbers that only grow say nothing about today, so these are all live.
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
  const myLeaveQueueQ = user
    ? dataClient
        .from("leave_requests")
        .select("id, current_approver_user_id, reliever_id, current_stage_code, approval_stage")
        .in("status", PENDING_LEAVE_STATUSES)
        .or(`current_approver_user_id.eq.${user.id},reliever_id.eq.${user.id}`)
        .returns<LeaveQueueRow[]>()
    : Promise.resolve({ data: [] as LeaveQueueRow[], error: null })

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
    if (row.current_approver_user_id === user?.id) return true
    const stage = String(row.current_stage_code || row.approval_stage || "").toLowerCase()
    return row.reliever_id === user?.id && (stage === "pending_reliever" || stage === "reliever_pending")
  }).length

  let filteredRawActivity: ActivityLogRow[] = []
  if (canSeeAuditActivity) {
    const activitySelect =
      "id, user_id, created_at, action, operation, entity_type, table_name, entity_id, department, metadata, changed_fields, new_values, old_values"
    let rawActivity: ActivityLogRow[] = []

    if (departmentScope) {
      if (queryDepartmentScope && queryDepartmentScope.length > 0) {
        const [departmentActivity, userActivity] = await Promise.all([
          dataClient
            .from("audit_logs")
            .select(activitySelect)
            .neq("action", "client_error")
            .neq("entity_type", "ui_runtime")
            .in("department", queryDepartmentScope)
            .order("created_at", { ascending: false })
            .limit(20)
            .returns<ActivityLogRow[]>(),
          scopedUserIds.length > 0
            ? dataClient
                .from("audit_logs")
                .select(activitySelect)
                .neq("action", "client_error")
                .neq("entity_type", "ui_runtime")
                .in("user_id", scopedUserIds)
                .order("created_at", { ascending: false })
                .limit(20)
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
      const { data, error: auditError } = await dataClient
        .from("audit_logs")
        .select(activitySelect)
        .neq("action", "client_error")
        .neq("entity_type", "ui_runtime")
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<ActivityLogRow[]>()
      if (auditError) log.error("Recent activity query failed", auditError)
      rawActivity = data || []
    }

    filteredRawActivity = rawActivity.filter((item) => !isExcludedActivity(item)).slice(0, 8)
  }

  const actorIds = Array.from(new Set(filteredRawActivity.map((item) => item.user_id).filter(Boolean)))
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

  const recentActivity = buildRecentActivity(filteredRawActivity, actorMap)
  const accessContext = scope ? buildAccessContextV2(scope) : null
  const canAccessAction = (_requiredRoles: string[], href: string) =>
    Boolean(accessContext && canAccessRouteV2(accessContext, resolveAdminRouteKeyV2(href)))

  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`
  const pendingLeaveCount = pendingLeave.count || 0
  const actionQueue: ActionQueueItem[] = [
    // Approvals first: they are the items only an admin can unblock.
    {
      id: "leave-approvals",
      group: "approvals" as const,
      tone: "attention" as const,
      title: "Leave awaiting your approval",
      description: `${plural(myLeaveApprovals, "request")} at your approval or reliever stage`,
      count: myLeaveApprovals,
      href: "/admin/hr/leave",
    },
    {
      id: "leave-pending",
      group: "approvals" as const,
      tone: "attention" as const,
      title: "Leave requests pending",
      description: "Every undecided request in your scope, at any stage",
      count: pendingLeaveCount,
      href: "/admin/hr/leave",
    },
    {
      id: "attendance-appeals",
      group: "approvals" as const,
      tone: "attention" as const,
      title: "Attendance appeals",
      description: "Staff asking for an attendance status to be corrected",
      count: pendingAppeals.count || 0,
      href: "/admin/hr/attendance?tab=appeals",
    },
    {
      id: "ticket-approvals",
      group: "approvals" as const,
      tone: "attention" as const,
      title: "Help desk tickets awaiting approval",
      description: "Requests that need sign-off before work starts",
      count: ticketApprovals.count || 0,
      href: "/admin/help-desk/management",
    },
    {
      id: "pending-requisitions",
      group: "approvals" as const,
      tone: "attention" as const,
      title: "Requisitions in approval",
      description: "Pending at review, authorization or verification",
      count: pendingRequisitions.count || 0,
      href: "/admin/accounts/requisitions",
    },
    {
      id: "pending-users",
      group: "approvals" as const,
      tone: "attention" as const,
      title: "New users awaiting approval",
      description: "Sign-ups waiting to be approved or rejected",
      count: pendingUsers.count || 0,
      href: "/admin/hr/employees",
    },
    {
      id: "tasks-awaiting-review",
      group: "approvals" as const,
      tone: "attention" as const,
      title: "Tasks awaiting review",
      description: "Submitted by staff and waiting on a reviewer",
      count: awaitingReviewCount,
      href: "/admin/tasks",
    },
    // Then work that is late or stuck.
    {
      id: "overdue-tasks",
      group: "attention" as const,
      tone: "critical" as const,
      title: "Overdue tasks",
      description: "Pending or in progress past their deadline",
      count: overdueTaskCount,
      href: "/admin/tasks",
    },
    {
      id: "payments-due",
      group: "attention" as const,
      tone: "critical" as const,
      title: "Payments overdue or due this week",
      description: `Overdue, or due within ${PAYMENT_DUE_WINDOW_DAYS} days`,
      count: paymentsDue.count || 0,
      href: "/admin/accounts/payments",
    },
    {
      id: "blocked-tasks",
      group: "attention" as const,
      tone: "attention" as const,
      title: "Tasks reported blocked",
      description: "Unable to complete: extend, reassign or cancel",
      count: blockedTaskCount,
      href: "/admin/tasks",
    },
    {
      id: "open-tickets",
      group: "attention" as const,
      tone: "info" as const,
      title: "Open help desk tickets",
      description: "Not yet resolved, closed or cancelled",
      count: openTickets.count || 0,
      href: "/admin/help-desk/management",
    },
    {
      id: "open-feedback",
      group: "attention" as const,
      tone: "info" as const,
      title: "Open feedback",
      description: "Staff feedback not yet responded to",
      count: openFeedback.count || 0,
      href: "/admin/feedback",
    },
  ].filter((item) => canAccessAction([], item.href))

  const canManageEmployees = canAccessAction(["developer", "super_admin", "admin"], "/admin/hr/employees")
  const canReviewTasks = canAccessAction(["developer", "super_admin", "admin"], "/admin/tasks")
  const canOpenReports = canAccessAction(["developer", "super_admin", "admin"], "/admin/reports")

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Admin Dashboard"
        description={`Welcome back, ${formatName(profile?.first_name) || "Admin"}. Here is what needs action across your scope.`}
        icon={Shield}
        actions={
          <>
            {canManageEmployees && (
              <Button asChild size="sm">
                <Link href="/admin/hr/employees">Manage Employees</Link>
              </Button>
            )}
            {canReviewTasks && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/tasks">Review Tasks</Link>
              </Button>
            )}
            {canOpenReports && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/reports">Open Reports</Link>
              </Button>
            )}
          </>
        }
      />

      {/* StatGrid keeps the first three on a phone, so source order is the mobile priority. */}
      <Section title="Today" description="Live counts for the people and work in your scope.">
        <StatGrid>
          <StatCard
            variant="compact"
            title="Clocked In Today"
            value={clockedIn.count || 0}
            description={`of ${activeStaff.count || 0} active staff`}
            icon={Clock}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            variant="compact"
            title="Overdue Tasks"
            value={overdueTaskCount}
            description={overdueTaskCount > 0 ? "Past their deadline" : "Nothing overdue"}
            icon={AlertTriangle}
            iconBgColor={overdueTaskCount > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}
            iconColor={overdueTaskCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}
          />
          <StatCard
            variant="compact"
            title="Pending Leave"
            value={pendingLeave.count || 0}
            description="Requests not yet decided"
            icon={CalendarClock}
            iconBgColor="bg-amber-100 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            variant="compact"
            title="Open Tasks"
            value={openTaskRows.length}
            description="Pending, in progress, in review or blocked"
            icon={ClipboardList}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            variant="compact"
            title="Active Staff"
            value={activeStaff.count || 0}
            description="Current employees"
            icon={Users}
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
        </StatGrid>
      </Section>

      {/* 2x2 on desktop with every row the same height; each card scrolls inside
          it instead of leaving the grid ragged. Phones stack at natural height. */}
      <div className="grid grid-cols-1 gap-6 lg:auto-rows-[400px] lg:grid-cols-2">
        <ActionQueue
          title="Pending approvals"
          icon={Stamp}
          items={actionQueue.filter((item) => item.group === "approvals")}
          emptyTitle="No approvals waiting"
          emptyDescription="Leave, appeals, requisitions and sign-ups awaiting a decision will appear here."
        />
        <ActionQueue
          title="Needs attention"
          icon={AlertTriangle}
          items={actionQueue.filter((item) => item.group === "attention")}
          emptyTitle="Nothing overdue or stuck"
          emptyDescription="Overdue tasks, due payments and open tickets will appear here."
        />
        <AwayToday items={awayToday} todayIso={todayIso} />
        {canSeeAuditActivity && (
          <RecentActivityFeed activity={recentActivity} showViewAll={canAccessAction([], "/admin/audit-logs")} />
        )}
      </div>
    </PageWrapper>
  )
}
