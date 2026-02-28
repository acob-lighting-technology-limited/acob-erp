import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminNotificationContent, type DynamicNotification } from "./admin-notification-content"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

async function formatRelativeTime(dateString: string): Promise<string> {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "Just now"
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? "s" : ""} ago`
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? "s" : ""} ago`
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

async function getAdminNotificationsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return { redirect: "/dashboard" as const }
  }
  const departmentScope = getDepartmentScope(scope, "general")
  const profileIdsInScope = departmentScope
    ? (departmentScope.length > 0
        ? await supabase.from("profiles").select("id").in("department", departmentScope)
        : ({ data: [] as { id: string }[] } as any)
      ).data || []
    : null
  const scopedUserIds = profileIdsInScope ? profileIdsInScope.map((p: any) => p.id) : []

  const notificationList: DynamicNotification[] = []
  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const timestamp = await formatRelativeTime(now.toISOString())

  // Pending user approvals
  try {
    const { count: pendingUsersCount } = await supabase
      .from("pending_users")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    if (pendingUsersCount && pendingUsersCount > 0) {
      notificationList.push({
        id: "pending-users",
        type: "warning",
        category: "users",
        title: "Pending User Approvals",
        message: `${pendingUsersCount} user${pendingUsersCount > 1 ? "s" : ""} waiting for approval`,
        timestamp,
        link: "/admin/hr/employees",
        linkText: "Review Employees",
        read: false,
        priority: "high",
      })
    }
  } catch (e) {}

  // Open feedback
  try {
    let openFeedbackQuery = supabase.from("feedback").select("*", { count: "exact", head: true }).eq("status", "open")
    if (departmentScope) {
      openFeedbackQuery =
        scopedUserIds.length > 0
          ? openFeedbackQuery.in("user_id", scopedUserIds)
          : openFeedbackQuery.eq("id", "__none__")
    }
    const { count: openFeedbackCount } = await openFeedbackQuery

    if (openFeedbackCount && openFeedbackCount > 0) {
      notificationList.push({
        id: "open-feedback",
        type: "info",
        category: "feedback",
        title: "Open Feedback",
        message: `${openFeedbackCount} open feedback item${openFeedbackCount > 1 ? "s" : ""} need attention`,
        timestamp,
        link: "/admin/feedback",
        linkText: "View Feedback",
        read: false,
        priority: "normal",
      })
    }
  } catch (e) {}

  // Urgent tasks
  try {
    let urgentTasksQuery = supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("priority", "urgent")
      .in("status", ["pending", "in_progress"])
    if (departmentScope) {
      urgentTasksQuery =
        departmentScope.length > 0
          ? urgentTasksQuery.in("department", departmentScope)
          : urgentTasksQuery.eq("id", "__none__")
    }
    const { count: urgentTasksCount } = await urgentTasksQuery

    if (urgentTasksCount && urgentTasksCount > 0) {
      notificationList.push({
        id: "urgent-tasks",
        type: "error",
        category: "tasks",
        title: "Urgent Tasks",
        message: `${urgentTasksCount} urgent task${urgentTasksCount > 1 ? "s" : ""} need immediate attention`,
        timestamp,
        link: "/admin/tasks",
        linkText: "View Tasks",
        read: false,
        priority: "urgent",
      })
    }
  } catch (e) {}

  // Overdue tasks
  try {
    let overdueTasksQuery = supabase
      .from("tasks")
      .select("id")
      .lt("due_date", today)
      .in("status", ["pending", "in_progress"])
    if (departmentScope) {
      overdueTasksQuery =
        departmentScope.length > 0
          ? overdueTasksQuery.in("department", departmentScope)
          : overdueTasksQuery.eq("id", "__none__")
    }
    const { data: overdueTasks } = await overdueTasksQuery

    if (overdueTasks && overdueTasks.length > 0) {
      notificationList.push({
        id: "overdue-tasks",
        type: "error",
        category: "tasks",
        title: "Overdue Tasks",
        message: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} need to be completed`,
        timestamp,
        link: "/admin/tasks",
        linkText: "View Tasks",
        read: false,
        priority: "urgent",
      })
    }
  } catch (e) {}

  // Overdue payments
  try {
    const { data: overduePayments } = await supabase
      .from("department_payments")
      .select("id")
      .lt("next_payment_due", now.toISOString())
      .eq("status", "due")

    if (overduePayments && overduePayments.length > 0) {
      notificationList.push({
        id: "overdue-payments",
        type: "error",
        category: "payments",
        title: "Overdue Payments",
        message: `${overduePayments.length} payment${overduePayments.length > 1 ? "s" : ""} past due date`,
        timestamp,
        link: "/admin/finance/payments",
        linkText: "View Payments",
        read: false,
        priority: "urgent",
      })
    }
  } catch (e) {}

  // Payments due soon (within 7 days)
  try {
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    const { data: dueSoonPayments } = await supabase
      .from("department_payments")
      .select("id")
      .gte("next_payment_due", now.toISOString())
      .lte("next_payment_due", sevenDaysFromNow.toISOString())
      .eq("status", "due")

    if (dueSoonPayments && dueSoonPayments.length > 0) {
      notificationList.push({
        id: "due-soon-payments",
        type: "warning",
        category: "payments",
        title: "Payments Due Soon",
        message: `${dueSoonPayments.length} payment${dueSoonPayments.length > 1 ? "s" : ""} due within 7 days`,
        timestamp,
        link: "/admin/finance/payments",
        linkText: "View Payments",
        read: false,
        priority: "high",
      })
    }
  } catch (e) {}

  // Pending leave requests
  try {
    let pendingLeaveQuery = supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
    if (departmentScope) {
      pendingLeaveQuery =
        scopedUserIds.length > 0
          ? pendingLeaveQuery.in("user_id", scopedUserIds)
          : pendingLeaveQuery.eq("id", "__none__")
    }
    const { count: pendingLeaveCount } = await pendingLeaveQuery

    if (pendingLeaveCount && pendingLeaveCount > 0) {
      notificationList.push({
        id: "pending-leave",
        type: "warning",
        category: "leave",
        title: "Pending Leave Requests",
        message: `${pendingLeaveCount} leave request${pendingLeaveCount > 1 ? "s" : ""} awaiting approval`,
        timestamp,
        link: "/admin/hr/leave",
        linkText: "Review Requests",
        read: false,
        priority: "high",
      })
    }
  } catch (e) {}

  // Unresolved asset issues
  try {
    const { count: assetIssuesCount } = await supabase
      .from("asset_issues")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])

    if (assetIssuesCount && assetIssuesCount > 0) {
      notificationList.push({
        id: "asset-issues",
        type: "warning",
        category: "assets",
        title: "Unresolved Asset Issues",
        message: `${assetIssuesCount} asset issue${assetIssuesCount > 1 ? "s" : ""} need attention`,
        timestamp,
        link: "/admin/assets/issues",
        linkText: "View Issues",
        read: false,
        priority: "normal",
      })
    }
  } catch (e) {}

  // Assets in maintenance
  try {
    let maintenanceQuery = supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("status", "maintenance")
    if (departmentScope) {
      maintenanceQuery =
        departmentScope.length > 0
          ? maintenanceQuery.in("department", departmentScope)
          : maintenanceQuery.eq("id", "__none__")
    }
    const { count: maintenanceCount } = await maintenanceQuery

    if (maintenanceCount && maintenanceCount > 0) {
      notificationList.push({
        id: "assets-maintenance",
        type: "info",
        category: "assets",
        title: "Assets in Maintenance",
        message: `${maintenanceCount} asset${maintenanceCount > 1 ? "s" : ""} currently in maintenance`,
        timestamp,
        link: "/admin/assets",
        linkText: "View Assets",
        read: false,
        priority: "low",
      })
    }
  } catch (e) {}

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
  notificationList.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return { notifications: notificationList }
}

export default async function AdminNotificationPage() {
  const data = await getAdminNotificationsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const notificationsData = data as { notifications: DynamicNotification[] }

  return <AdminNotificationContent initialNotifications={notificationsData.notifications} />
}
