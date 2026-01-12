"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Bell,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  CheckCheck,
  ArrowLeft,
  User,
  Package,
  AlertTriangle,
  Clock,
  ChevronRight,
  Filter,
  ShieldCheck,
  CreditCard,
  CalendarClock,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"

export interface DynamicNotification {
  id: string
  type: "info" | "warning" | "success" | "error"
  category: string
  title: string
  message: string
  timestamp: string
  link?: string
  linkText?: string
  read: boolean
  priority: "low" | "normal" | "high" | "urgent"
}

// Type icons
const typeIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertCircle,
}

// Type colors
const typeColors = {
  info: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10",
  warning: "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/10",
  success: "border-l-green-500 bg-green-50/50 dark:bg-green-950/10",
  error: "border-l-red-500 bg-red-50/50 dark:bg-red-950/10",
}

// Format relative time
function formatRelativeTime(dateString: string): string {
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

interface AdminNotificationContentProps {
  initialNotifications: DynamicNotification[]
}

export function AdminNotificationContent({ initialNotifications }: AdminNotificationContentProps) {
  const router = useRouter()
  const supabase = createClient()

  const [notifications, setNotifications] = useState<DynamicNotification[]>(initialNotifications)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  // Reload notifications
  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const notificationList: DynamicNotification[] = []
      const now = new Date()
      const today = now.toISOString().split("T")[0]
      const timestamp = formatRelativeTime(now.toISOString())

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
            link: "/admin/staff",
            linkText: "Review Users",
            read: readIds.has("pending-users"),
            priority: "high",
          })
        }
      } catch (e) {}

      // Open feedback
      try {
        const { count: openFeedbackCount } = await supabase
          .from("feedback")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")

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
            read: readIds.has("open-feedback"),
            priority: "normal",
          })
        }
      } catch (e) {}

      // Urgent tasks
      try {
        const { count: urgentTasksCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("priority", "urgent")
          .in("status", ["pending", "in_progress"])

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
            read: readIds.has("urgent-tasks"),
            priority: "urgent",
          })
        }
      } catch (e) {}

      // Overdue tasks
      try {
        const { data: overdueTasks } = await supabase
          .from("tasks")
          .select("id")
          .lt("due_date", today)
          .in("status", ["pending", "in_progress"])

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
            read: readIds.has("overdue-tasks"),
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
            link: "/admin/payments",
            linkText: "View Payments",
            read: readIds.has("overdue-payments"),
            priority: "urgent",
          })
        }
      } catch (e) {}

      // Payments due soon
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
            link: "/admin/payments",
            linkText: "View Payments",
            read: readIds.has("due-soon-payments"),
            priority: "high",
          })
        }
      } catch (e) {}

      // Pending leave requests
      try {
        const { count: pendingLeaveCount } = await supabase
          .from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")

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
            read: readIds.has("pending-leave"),
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
            read: readIds.has("asset-issues"),
            priority: "normal",
          })
        }
      } catch (e) {}

      // Assets in maintenance
      try {
        const { count: maintenanceCount } = await supabase
          .from("assets")
          .select("*", { count: "exact", head: true })
          .eq("status", "maintenance")

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
            read: readIds.has("assets-maintenance"),
            priority: "low",
          })
        }
      } catch (e) {}

      // Sort by priority
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
      notificationList.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

      setNotifications(notificationList)
      toast.success("Notifications refreshed")
    } catch (error: any) {
      console.error("Error loading notifications:", error)
      toast.error("Failed to refresh notifications")
    } finally {
      setIsLoading(false)
    }
  }

  // Mark as read
  const markAsRead = (notificationId: string) => {
    setReadIds((prev) => {
      const newSet = new Set(Array.from(prev))
      newSet.add(notificationId)
      return newSet
    })
  }

  // Mark all as read
  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map((n) => n.id)))
    toast.success("All notifications marked as read")
  }

  // Handle notification click
  const handleNotificationClick = (notification: DynamicNotification) => {
    markAsRead(notification.id)
    if (notification.link) {
      router.push(notification.link)
    }
  }

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread" && readIds.has(n.id)) return false
    if (activeTab !== "all" && activeTab !== "unread" && n.category !== activeTab) return false
    if (priorityFilter !== "all" && n.priority !== priorityFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return n.title.toLowerCase().includes(query) || n.message.toLowerCase().includes(query)
    }
    return true
  })

  // Calculate counts
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length
  const categoryCounts = {
    all: notifications.length,
    unread: unreadCount,
    tasks: notifications.filter((n) => n.category === "tasks").length,
    assets: notifications.filter((n) => n.category === "assets").length,
    feedback: notifications.filter((n) => n.category === "feedback").length,
    payments: notifications.filter((n) => n.category === "payments").length,
    leave: notifications.filter((n) => n.category === "leave").length,
    users: notifications.filter((n) => n.category === "users").length,
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:text-3xl">
                <Bell className="h-7 w-7" />
                Admin Notifications
              </h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                <ShieldCheck className="h-4 w-4" />
                System-wide notifications and alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={loadNotifications} variant="outline" size="icon" title="Refresh" disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" className="gap-2">
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{categoryCounts.all}</div>
              <div className="text-muted-foreground text-xs">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{categoryCounts.unread}</div>
              <div className="text-muted-foreground text-xs">Unread</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{categoryCounts.users}</div>
              <div className="text-muted-foreground text-xs">Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{categoryCounts.tasks}</div>
              <div className="text-muted-foreground text-xs">Tasks</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{categoryCounts.payments}</div>
              <div className="text-muted-foreground text-xs">Payments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{categoryCounts.leave}</div>
              <div className="text-muted-foreground text-xs">Leave</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-indigo-600">{categoryCounts.assets}</div>
              <div className="text-muted-foreground text-xs">Assets</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-teal-600">{categoryCounts.feedback}</div>
              <div className="text-muted-foreground text-xs">Feedback</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <div className="border-b p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b">
              <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b-0 bg-transparent p-0">
                <TabsTrigger
                  value="all"
                  className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 whitespace-nowrap data-[state=active]:bg-transparent"
                >
                  All
                  {categoryCounts.all > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {categoryCounts.all}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="unread"
                  className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 whitespace-nowrap data-[state=active]:bg-transparent"
                >
                  Unread
                  {categoryCounts.unread > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {categoryCounts.unread}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="payments"
                  className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 whitespace-nowrap data-[state=active]:bg-transparent"
                >
                  <CreditCard className="mr-1 h-4 w-4" />
                  Payments
                  {categoryCounts.payments > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {categoryCounts.payments}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="leave"
                  className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 whitespace-nowrap data-[state=active]:bg-transparent"
                >
                  <CalendarClock className="mr-1 h-4 w-4" />
                  Leave
                  {categoryCounts.leave > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {categoryCounts.leave}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="tasks"
                  className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 whitespace-nowrap data-[state=active]:bg-transparent"
                >
                  <Clock className="mr-1 h-4 w-4" />
                  Tasks
                  {categoryCounts.tasks > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {categoryCounts.tasks}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="assets"
                  className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 whitespace-nowrap data-[state=active]:bg-transparent"
                >
                  <Package className="mr-1 h-4 w-4" />
                  Assets
                  {categoryCounts.assets > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {categoryCounts.assets}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="users"
                  className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 whitespace-nowrap data-[state=active]:bg-transparent"
                >
                  <User className="mr-1 h-4 w-4" />
                  Users
                  {categoryCounts.users > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {categoryCounts.users}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="mt-0">
              <div className="min-h-[400px]" style={{ maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>
                {filteredNotifications.length > 0 ? (
                  <div className="divide-y">
                    {filteredNotifications.map((notification) => {
                      const Icon = typeIcons[notification.type]
                      const isRead = readIds.has(notification.id)

                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            "group hover:bg-muted/30 relative flex cursor-pointer items-center gap-3 border-l-2 px-4 py-3 transition-all",
                            typeColors[notification.type],
                            isRead && "opacity-60"
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {/* Icon */}
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              notification.type === "error"
                                ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                                : notification.type === "warning"
                                  ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400"
                                  : notification.type === "success"
                                    ? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
                                    : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Content */}
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={cn("truncate text-sm", !isRead && "font-semibold")}>
                                  {notification.title}
                                </span>
                                <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                                  — {notification.message}
                                </span>
                              </div>
                            </div>

                            {/* Badges and meta */}
                            <div className="hidden shrink-0 items-center gap-2 sm:flex">
                              {notification.priority !== "normal" && (
                                <Badge
                                  variant={notification.priority === "urgent" ? "destructive" : "secondary"}
                                  className="px-1.5 py-0 text-[10px]"
                                >
                                  {notification.priority}
                                </Badge>
                              )}
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                {notification.category}
                              </Badge>
                              <span className="text-muted-foreground text-xs whitespace-nowrap">
                                {notification.timestamp}
                              </span>
                            </div>

                            {/* Arrow */}
                            {notification.link && <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center px-4 py-16">
                    <div className="bg-muted mb-4 rounded-full p-6">
                      <Bell className="text-muted-foreground h-16 w-16 opacity-50" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">
                      {searchQuery ? "No matching notifications" : "No notifications"}
                    </h3>
                    <p className="text-muted-foreground max-w-md text-center text-sm">
                      {searchQuery
                        ? "Try adjusting your search terms or filters"
                        : "You're all caught up! Everything is running smoothly."}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
