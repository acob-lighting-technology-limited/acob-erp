import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  Calendar,
  MessageSquare,
  FileSignature,
  Droplet,
  ArrowRight,
  Clock,
} from "lucide-react"
import { Notifications } from "@/components/notifications"
import { formatName } from "@/lib/utils"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data } = await supabase.auth.getUser()
  const userId = data?.user?.id

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single()

  // Fetch user's recent feedbacks
  const { data: feedbacks } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch notifications for user
  const notifications = []

  // Assigned tasks (pending or in progress)
  const { data: assignedTasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date")
    .eq("assigned_to", userId)
    .in("status", ["pending", "in_progress"])

  if (assignedTasks && assignedTasks.length > 0) {
    const pendingTasks = assignedTasks.filter(t => t.status === "pending")
    if (pendingTasks.length > 0) {
      notifications.push({
        id: "pending-tasks",
        type: "info" as const,
        title: "Pending Tasks",
        message: `You have ${pendingTasks.length} pending task${pendingTasks.length > 1 ? "s" : ""} assigned to you.`,
        timestamp: "Active",
        link: "/tasks",
        linkText: "View Tasks",
      })
    }

    // Urgent tasks
    const urgentTasks = assignedTasks.filter(t => t.priority === "urgent")
    if (urgentTasks.length > 0) {
      notifications.push({
        id: "urgent-tasks",
        type: "error" as const,
        title: "Urgent Tasks",
        message: `You have ${urgentTasks.length} urgent task${urgentTasks.length > 1 ? "s" : ""} that need immediate attention.`,
        timestamp: "Urgent",
        link: "/tasks",
        linkText: "View Tasks",
      })
    }

    // Overdue tasks
    const today = new Date().toISOString().split("T")[0]
    const overdueTasks = assignedTasks.filter(
      t => t.due_date && t.due_date < today
    )
    if (overdueTasks.length > 0) {
      notifications.push({
        id: "overdue-tasks",
        type: "error" as const,
        title: "Overdue Tasks",
        message: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} that need to be completed.`,
        timestamp: "Overdue",
        link: "/tasks",
        linkText: "View Tasks",
      })
    }

    // Tasks due soon (within 3 days)
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    const dueSoonTasks = assignedTasks.filter(
      t => t.due_date && t.due_date >= today && t.due_date <= threeDaysFromNow.toISOString().split("T")[0]
    )
    if (dueSoonTasks.length > 0) {
      notifications.push({
        id: "due-soon-tasks",
        type: "warning" as const,
        title: "Tasks Due Soon",
        message: `You have ${dueSoonTasks.length} task${dueSoonTasks.length > 1 ? "s" : ""} due within 3 days.`,
        timestamp: "Upcoming",
        link: "/tasks",
        linkText: "View Tasks",
      })
    }
  }

  // Feedback status updates
  const { data: resolvedFeedback } = await supabase
    .from("feedback")
    .select("id, title, status, updated_at")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .order("updated_at", { ascending: false })
    .limit(3)

  if (resolvedFeedback && resolvedFeedback.length > 0) {
    const recentResolved = resolvedFeedback.filter(f => {
      const updatedAt = new Date(f.updated_at)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      return updatedAt >= oneDayAgo
    })

    if (recentResolved.length > 0) {
      notifications.push({
        id: "resolved-feedback",
        type: "success" as const,
        title: "Feedback Resolved",
        message: `${recentResolved.length} of your feedback item${recentResolved.length > 1 ? "s have" : " has"} been resolved recently.`,
        timestamp: "Recent",
        link: "/feedback",
        linkText: "View Feedback",
      })
    }
  }

  // Profile completeness check
  const incompleteFields = []
  if (!profile?.phone_number) incompleteFields.push("phone number")
  if (!profile?.date_of_birth) incompleteFields.push("date of birth")
  if (!profile?.employment_date) incompleteFields.push("employment date")
  if (!profile?.job_description) incompleteFields.push("job description")

  if (incompleteFields.length > 0) {
    notifications.push({
      id: "incomplete-profile",
      type: "warning" as const,
      title: "Complete Your Profile",
      message: `Your profile is missing ${incompleteFields.slice(0, 2).join(" and ")}${incompleteFields.length > 2 ? " and more" : ""}.`,
      timestamp: "Reminder",
      link: "/profile",
      linkText: "Update Profile",
    })
  }

  const getInitials = (firstName?: string, lastName?: string, email?: string): string => {
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase()
    }
    if (email) {
      const localPart = email.split("@")[0]
      const parts = localPart.split(".")
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return localPart.substring(0, 2).toUpperCase()
    }
    return "U"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
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

  const quickActions = [
    {
      name: "Email Signature",
      href: "/signature",
      icon: FileSignature,
      description: "Create professional signature",
      color: "bg-blue-500",
    },
    {
      name: "Submit Feedback",
      href: "/feedback",
      icon: MessageSquare,
      description: "Share your thoughts",
      color: "bg-green-500",
    },
    {
      name: "Watermark Tool",
      href: "/watermark",
      icon: Droplet,
      description: "Add watermarks",
      color: "bg-purple-500",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Welcome back, {profile?.first_name || "Staff Member"}!
          </h1>
          <p className="mt-2 text-muted-foreground">Here's what's happening with your account today.</p>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Notifications notifications={notifications} title="Your Notifications" />
        )}

        {/* User Info Card */}
        <Card className="border-2 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-20 w-20 ring-4 ring-background shadow-xl">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {getInitials(profile?.first_name, profile?.last_name, data?.user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {formatName(profile?.first_name)} {formatName(profile?.last_name)}
                    {profile?.other_names && ` ${formatName(profile.other_names)}`}
                  </h2>
                  <p className="text-muted-foreground">{profile?.company_role || "Staff Member"}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{profile?.company_email || data?.user?.email}</span>
                  </div>
                  {profile?.phone_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{profile.phone_number}</span>
                    </div>
                  )}
                  {profile?.department && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{profile.department}</span>
                    </div>
                  )}
                  {profile?.current_work_location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{profile.current_work_location}</span>
                    </div>
                  )}
                </div>
              </div>
              <Link href="/profile">
                <Button variant="outline" className="gap-2">
                  <User className="h-4 w-4" />
                  Edit Profile
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Link key={action.name} href={action.href}>
                <Card className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer border-2 hover:border-primary">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`${action.color} p-3 rounded-lg text-white`}>
                        <action.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {action.name}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Feedbacks */}
        <Card className="border-2 shadow-lg">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Recent Feedback
              </CardTitle>
              <Link href="/feedback">
                <Button variant="ghost" size="sm" className="gap-2">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {feedbacks && feedbacks.length > 0 ? (
              <div className="space-y-2">
                {feedbacks.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-primary/10 rounded">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{feedback.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs ${getStatusColor(feedback.status)}`}>
                            {feedback.status?.replace("_", " ") || "Pending"}
                          </Badge>
                          {feedback.feedback_type && (
                            <Badge variant="outline" className="text-xs">{feedback.feedback_type}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(feedback.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link href="/feedback">
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No feedback yet</h3>
                <p className="text-muted-foreground mb-4">Start by submitting your first feedback</p>
                <Link href="/feedback">
                  <Button className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Submit Feedback
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Feedback</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{feedbacks?.length || 0}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Department</p>
                  <p className="text-2xl font-bold text-foreground mt-2">{profile?.department || "N/A"}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Work Location</p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {profile?.current_work_location || "N/A"}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MapPin className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
