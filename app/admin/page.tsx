import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import {
  Users,
  Laptop,
  ClipboardList,
  FileText,
  MessageSquare,
  ScrollText,
  Briefcase,
  TrendingUp,
  ArrowRight,
  Shield,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatName } from "@/lib/utils"

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single()

  // Fetch stats
  const [
    { count: staffCount },
    { count: deviceCount },
    { count: taskCount },
    { count: docCount },
    { count: feedbackCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("devices").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("user_documentation").select("*", { count: "exact", head: true }),
    supabase.from("feedback").select("*", { count: "exact", head: true }),
  ])

  // Recent activity
  const { data: recentTasks } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      status,
      priority,
      created_at,
      assigned_to
    `)
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch user profiles for tasks
  let tasksWithUsers = []
  if (recentTasks && recentTasks.length > 0) {
    const userIds = recentTasks.map((t: any) => t.assigned_to).filter(Boolean)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds)

    const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])
    
    tasksWithUsers = recentTasks.map((task: any) => ({
      ...task,
      assigned_to_user: profilesMap.get(task.assigned_to) || null,
    }))
  }

  const { data: recentFeedback } = await supabase
    .from("feedback")
    .select(`
      id,
      title,
      feedback_type,
      status,
      created_at,
      user_id
    `)
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch user profiles for feedback
  let feedbackWithUsers = []
  if (recentFeedback && recentFeedback.length > 0) {
    const userIds = recentFeedback.map((f: any) => f.user_id).filter(Boolean)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds)

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
      title: "Device Management",
      description: "Manage device inventory and assignments",
      href: "/admin/devices",
      icon: Laptop,
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
                      <p className="text-muted-foreground text-lg">
              Welcome back, {formatName(profile?.first_name) || "Admin"}! Manage your organization from here.
            </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Staff</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{staffCount || 0}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Devices</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{deviceCount || 0}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Laptop className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Tasks</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{taskCount || 0}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Documents</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{docCount || 0}</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Feedback</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{feedbackCount || 0}</p>
                </div>
                <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredActions.map((action) => (
              <Link key={action.href} href={action.href} className="h-full">
                <Card className="border-2 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer h-full flex flex-col">
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`${action.color} p-3 rounded-lg text-white`}>
                        <action.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{action.title}</h3>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Tasks */}
          <Card className="border-2">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Recent Tasks
                </CardTitle>
                <Link href="/admin/tasks">
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                    View All
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {tasksWithUsers && tasksWithUsers.length > 0 ? (
                <div className="space-y-2">
                  {tasksWithUsers.map((task: any) => (
                    <div key={task.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                      <p className="font-medium text-sm text-foreground truncate flex-1 min-w-0">
                        {task.title}
                      </p>
                      <Badge className={`${getStatusColor(task.status)} text-xs shrink-0`} variant="outline">
                        {task.status}
                      </Badge>
                      {task.priority && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {task.priority}
                        </Badge>
                      )}
                      {task.assigned_to_user && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatName(task.assigned_to_user.first_name)} {formatName(task.assigned_to_user.last_name)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDate(task.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No recent tasks</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Feedback */}
          <Card className="border-2">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Recent Feedback
                </CardTitle>
                <Link href="/admin/feedback">
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                    View All
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {feedbackWithUsers && feedbackWithUsers.length > 0 ? (
                <div className="space-y-2">
                  {feedbackWithUsers.map((feedback: any) => (
                    <div key={feedback.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                      <p className="font-medium text-sm text-foreground truncate flex-1 min-w-0">
                        {feedback.title}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {feedback.feedback_type || "N/A"}
                      </Badge>
                      <Badge className={`${getStatusColor(feedback.status)} text-xs shrink-0`} variant="outline">
                        {feedback.status}
                      </Badge>
                      {feedback.user && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatName(feedback.user.first_name)} {formatName(feedback.user.last_name)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDate(feedback.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No recent feedback</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
