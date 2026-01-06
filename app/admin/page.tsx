import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import {
  Users,
  Package,
  ClipboardList,
  FileText,
  MessageSquare,
  ScrollText,
  Briefcase,
  ArrowRight,
  Shield,
  Settings,
  CreditCard,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatName } from "@/lib/utils"

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch user profile with role
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).single()

  // Fetch stats
  const [
    { count: staffCount },
    { count: assetCount },
    { count: taskCount },
    { count: docCount },
    { count: feedbackCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("assets").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("user_documentation").select("*", { count: "exact", head: true }),
    supabase.from("feedback").select("*", { count: "exact", head: true }),
  ])

  // Recent activity
  const { data: recentTasks } = await supabase
    .from("tasks")
    .select(
      `
      id,
      title,
      status,
      priority,
      created_at,
      assigned_to
    `
    )
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch user profiles for tasks
  let tasksWithUsers = []
  if (recentTasks && recentTasks.length > 0) {
    const userIds = recentTasks.map((t: any) => t.assigned_to).filter(Boolean)
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds)

    const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

    tasksWithUsers = recentTasks.map((task: any) => ({
      ...task,
      assigned_to_user: profilesMap.get(task.assigned_to) || null,
    }))
  }

  const { data: recentFeedback } = await supabase
    .from("feedback")
    .select(
      `
      id,
      title,
      feedback_type,
      status,
      created_at,
      user_id
    `
    )
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch user profiles for feedback
  let feedbackWithUsers = []
  if (recentFeedback && recentFeedback.length > 0) {
    const userIds = recentFeedback.map((f: any) => f.user_id).filter(Boolean)
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds)

    const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

    feedbackWithUsers = recentFeedback.map((feedback: any) => ({
      ...feedback,
      user: profilesMap.get(feedback.user_id) || null,
    }))
  }

  // Fetch notifications for admin
  const notifications = []

  // Pending user approvals
  const { count: pendingUsersCount } = await supabase
    .from("pending_users")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  if (pendingUsersCount && pendingUsersCount > 0) {
    notifications.push({
      id: "pending-users",
      type: "warning" as const,
      title: "Pending User Approvals",
      message: `You have ${pendingUsersCount} user${pendingUsersCount > 1 ? "s" : ""} waiting for approval.`,
      timestamp: "Just now",
      link: "/admin/staff",
      linkText: "Review Users",
    })
  }

  // Open feedback that needs attention
  const { count: openFeedbackCount } = await supabase
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .eq("status", "open")

  if (openFeedbackCount && openFeedbackCount > 0) {
    notifications.push({
      id: "open-feedback",
      type: "info" as const,
      title: "Open Feedback",
      message: `There ${openFeedbackCount === 1 ? "is" : "are"} ${openFeedbackCount} open feedback item${openFeedbackCount > 1 ? "s" : ""} that need attention.`,
      timestamp: "Recent",
      link: "/admin/feedback",
      linkText: "View Feedback",
    })
  }

  // Urgent tasks
  const { count: urgentTasksCount } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("priority", "urgent")
    .in("status", ["pending", "in_progress"])

  if (urgentTasksCount && urgentTasksCount > 0) {
    notifications.push({
      id: "urgent-tasks",
      type: "error" as const,
      title: "Urgent Tasks",
      message: `You have ${urgentTasksCount} urgent task${urgentTasksCount > 1 ? "s" : ""} that need immediate attention.`,
      timestamp: "Urgent",
      link: "/admin/tasks",
      linkText: "View Tasks",
    })
  }

  // Overdue tasks
  const today = new Date().toISOString().split("T")[0]
  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: false })
    .lt("due_date", today)
    .in("status", ["pending", "in_progress"])

  if (overdueTasks && overdueTasks.length > 0) {
    notifications.push({
      id: "overdue-tasks",
      type: "error" as const,
      title: "Overdue Tasks",
      message: `There ${overdueTasks.length === 1 ? "is" : "are"} ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} that need to be completed.`,
      timestamp: "Overdue",
      link: "/admin/tasks",
      linkText: "View Tasks",
    })
  }

  // Recent audit logs (show if there are many actions today)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: todayAuditCount } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString())

  if (todayAuditCount && todayAuditCount > 50) {
    notifications.push({
      id: "high-activity",
      type: "info" as const,
      title: "High System Activity",
      message: `There have been ${todayAuditCount} system activities today. Review audit logs for details.`,
      timestamp: "Today",
      link: "/admin/audit-logs",
      linkText: "View Audit Logs",
    })
  }

  const quickActions = [
    {
      title: "Staff Management",
      description: "View and manage all staff members",
      href: "/admin/staff",
      icon: Users,
      color: "bg-blue-500",
      roles: ["super_admin", "admin"],
    },
    {
      title: "Asset Management",
      description: "Manage asset inventory and assignments",
      href: "/admin/assets",
      icon: Package,
      color: "bg-purple-500",
      roles: ["super_admin", "admin"],
    },
    {
      title: "Task Management",
      description: "Create and assign tasks to staff",
      href: "/admin/tasks",
      icon: ClipboardList,
      color: "bg-green-500",
      roles: ["super_admin", "admin", "lead"],
    },
    {
      title: "Documentation",
      description: "View all staff documentation",
      href: "/admin/documentation",
      icon: FileText,
      color: "bg-orange-500",
      roles: ["super_admin", "admin", "lead"],
    },
    {
      title: "Job Descriptions",
      description: "View staff job descriptions",
      href: "/admin/job-descriptions",
      icon: Briefcase,
      color: "bg-pink-500",
      roles: ["super_admin", "admin", "lead"],
    },
    {
      title: "Feedback Management",
      description: "Review and respond to feedback",
      href: "/admin/feedback",
      icon: MessageSquare,
      color: "bg-cyan-500",
      roles: ["super_admin", "admin", "lead"],
    },
    {
      title: "Audit Logs",
      description: "View system activity logs",
      href: "/admin/audit-logs",
      icon: ScrollText,
      color: "bg-red-500",
      roles: ["super_admin", "admin", "lead"],
    },
    {
      title: "Payments",
      description: "Manage department payments",
      href: "/admin/payments",
      icon: CreditCard,
      color: "bg-indigo-500",
      roles: ["super_admin", "admin"],
    },
    {
      title: "HR Administration",
      description: "Manage leave, attendance, and performance",
      href: "/admin/hr",
      icon: Users,
      color: "bg-teal-500",
      roles: ["super_admin", "admin", "lead"],
    },
    {
      title: "System Settings",
      description: "Configure shutdown and maintenance modes",
      href: "/admin/settings",
      icon: Settings,
      color: "bg-gray-500",
      roles: ["super_admin"],
    },
  ]

  const canAccessAction = (requiredRoles: string[]) => {
    return profile?.role && requiredRoles.includes(profile.role)
  }

  const filteredActions = quickActions.filter((action) => canAccessAction(action.roles))

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Shield className="text-primary h-6 w-6" />
            <h1 className="text-foreground text-2xl font-bold md:text-3xl">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Welcome back, {formatName(profile?.first_name) || "Admin"}! Manage your organization from here.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Card className="border">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium">Total Staff</p>
                  <p className="text-foreground mt-0.5 text-lg font-bold">{staffCount || 0}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-1.5 dark:bg-blue-900/30">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium">Assets</p>
                  <p className="text-foreground mt-0.5 text-lg font-bold">{assetCount || 0}</p>
                </div>
                <div className="rounded-lg bg-purple-100 p-1.5 dark:bg-purple-900/30">
                  <Package className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium">Active Tasks</p>
                  <p className="text-foreground mt-0.5 text-lg font-bold">{taskCount || 0}</p>
                </div>
                <div className="rounded-lg bg-green-100 p-1.5 dark:bg-green-900/30">
                  <ClipboardList className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium">Documents</p>
                  <p className="text-foreground mt-0.5 text-lg font-bold">{docCount || 0}</p>
                </div>
                <div className="rounded-lg bg-orange-100 p-1.5 dark:bg-orange-900/30">
                  <FileText className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium">Feedback</p>
                  <p className="text-foreground mt-0.5 text-lg font-bold">{feedbackCount || 0}</p>
                </div>
                <div className="rounded-lg bg-cyan-100 p-1.5 dark:bg-cyan-900/30">
                  <MessageSquare className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="mb-2 text-base font-bold md:text-lg">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredActions.map((action) => (
              <Link key={action.href} href={action.href} className="h-full">
                <Card className="flex h-full cursor-pointer flex-col border transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex flex-1 flex-col p-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`${action.color} shrink-0 rounded-lg p-1.5 text-white`}>
                        <action.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-foreground mb-0.5 truncate text-xs font-semibold">{action.title}</h3>
                        <p className="text-muted-foreground line-clamp-2 text-[10px]">{action.description}</p>
                      </div>
                      <ArrowRight className="text-muted-foreground group-hover:text-primary hidden h-3.5 w-3.5 flex-shrink-0 transition-colors sm:block" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Recent Tasks */}
          <Card className="border">
            <CardHeader className="bg-muted/30 border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <ClipboardList className="h-4 w-4" />
                  Recent Tasks
                </CardTitle>
                <Link href="/admin/tasks">
                  <Badge variant="outline" className="hover:bg-accent cursor-pointer text-xs">
                    View All
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {tasksWithUsers && tasksWithUsers.length > 0 ? (
                <div className="space-y-2">
                  {tasksWithUsers.map((task: any) => (
                    <div
                      key={task.id}
                      className="flex flex-col gap-2 border-b py-2 last:border-0 sm:flex-row sm:items-center"
                    >
                      <p className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${getStatusColor(task.status)} shrink-0 text-xs`} variant="outline">
                          {task.status}
                        </Badge>
                        {task.priority && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {task.priority}
                          </Badge>
                        )}
                        {task.assigned_to_user && (
                          <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                            {formatName(task.assigned_to_user.first_name)} {formatName(task.assigned_to_user.last_name)}
                          </span>
                        )}
                        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                          {formatDate(task.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">No recent tasks</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Feedback */}
          <Card className="border">
            <CardHeader className="bg-muted/30 border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <MessageSquare className="h-4 w-4" />
                  Recent Feedback
                </CardTitle>
                <Link href="/admin/feedback">
                  <Badge variant="outline" className="hover:bg-accent cursor-pointer text-xs">
                    View All
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {feedbackWithUsers && feedbackWithUsers.length > 0 ? (
                <div className="space-y-2">
                  {feedbackWithUsers.map((feedback: any) => (
                    <div
                      key={feedback.id}
                      className="flex flex-col gap-2 border-b py-2 last:border-0 sm:flex-row sm:items-center"
                    >
                      <p className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">{feedback.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {feedback.feedback_type || "N/A"}
                        </Badge>
                        <Badge className={`${getStatusColor(feedback.status)} shrink-0 text-xs`} variant="outline">
                          {feedback.status}
                        </Badge>
                        {feedback.user && (
                          <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                            {formatName(feedback.user.first_name)} {formatName(feedback.user.last_name)}
                          </span>
                        )}
                        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                          {formatDate(feedback.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">No recent feedback</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
