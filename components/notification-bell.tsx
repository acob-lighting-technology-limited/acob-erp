"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Bell, AlertCircle, CheckCircle, Info, Clock, X, CheckCheck } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: "info" | "warning" | "success" | "error"
  title: string
  message: string
  timestamp?: string
  link?: string
  linkText?: string
  read?: boolean
  createdAt?: string
}

interface NotificationBellProps {
  isAdmin?: boolean
}

const notificationIcons = {
  info: Info,
  warning: AlertCircle,
  success: CheckCircle,
  error: AlertCircle,
}

const notificationColors = {
  info: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10",
  warning: "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/10",
  success: "border-l-green-500 bg-green-50/50 dark:bg-green-950/10",
  error: "border-l-red-500 bg-red-50/50 dark:bg-red-950/10",
}

const notificationIconColors = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  success: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
}

// Format relative time (e.g., "2 minutes ago", "1 hour ago")
function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "Just now"

  try {
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

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return "Just now"
  }
}

export function NotificationBell({ isAdmin = false }: NotificationBellProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchRef = useRef<Date>(new Date())

  useEffect(() => {
    // Only create client on client side
    if (typeof window === "undefined") {
      setIsLoading(false)
      return
    }

    // Lazy import to avoid SSR issues
    import("@/lib/supabase/client")
      .then(({ createClient }) => {
        const supabase = createClient()
        loadNotifications(supabase)

        // Set up polling every 30 seconds
        intervalRef.current = setInterval(() => {
          loadNotifications(supabase)
        }, 30000)
      })
      .catch((error) => {
        console.error("Error initializing Supabase client:", error)
        setIsLoading(false)
      })

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // Refresh when dropdown opens and update timestamps periodically
  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      import("@/lib/supabase/client").then(({ createClient }) => {
        const supabase = createClient()
        loadNotifications(supabase)
      })

      // Update relative timestamps every minute while open
      const timestampInterval = setInterval(() => {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            timestamp: formatRelativeTime(n.createdAt),
          }))
        )
      }, 60000)

      return () => clearInterval(timestampInterval)
    }
  }, [isOpen, isAdmin])

  const loadNotifications = async (supabase: any) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const notificationList: Notification[] = []
      const now = new Date()

      if (isAdmin) {
        // Admin notifications
        // Pending user approvals
        const { count: pendingUsersCount } = await supabase
          .from("pending_users")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")

        if (pendingUsersCount && pendingUsersCount > 0) {
          notificationList.push({
            id: "pending-users",
            type: "warning",
            title: "Pending User Approvals",
            message: `${pendingUsersCount} user${pendingUsersCount > 1 ? "s" : ""} waiting for approval`,
            timestamp: formatRelativeTime(now.toISOString()),
            createdAt: now.toISOString(),
            link: "/admin/hr/employees",
            linkText: "Review Employees",
            read: readIds.has("pending-users"),
          })
        }

        // Open feedback
        const { count: openFeedbackCount } = await supabase
          .from("feedback")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")

        if (openFeedbackCount && openFeedbackCount > 0) {
          notificationList.push({
            id: "open-feedback",
            type: "info",
            title: "Open Feedback",
            message: `${openFeedbackCount} open feedback item${openFeedbackCount > 1 ? "s" : ""} need attention`,
            timestamp: formatRelativeTime(now.toISOString()),
            createdAt: now.toISOString(),
            link: "/admin/feedback",
            linkText: "View Feedback",
            read: readIds.has("open-feedback"),
          })
        }

        // Urgent tasks
        const { count: urgentTasksCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("priority", "urgent")
          .in("status", ["pending", "in_progress"])

        if (urgentTasksCount && urgentTasksCount > 0) {
          notificationList.push({
            id: "urgent-tasks",
            type: "error",
            title: "Urgent Tasks",
            message: `${urgentTasksCount} urgent task${urgentTasksCount > 1 ? "s" : ""} need immediate attention`,
            timestamp: formatRelativeTime(now.toISOString()),
            createdAt: now.toISOString(),
            link: "/admin/tasks",
            linkText: "View Tasks",
            read: readIds.has("urgent-tasks"),
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
          notificationList.push({
            id: "overdue-tasks",
            type: "error",
            title: "Overdue Tasks",
            message: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} need to be completed`,
            timestamp: formatRelativeTime(now.toISOString()),
            createdAt: now.toISOString(),
            link: "/admin/tasks",
            linkText: "View Tasks",
            read: readIds.has("overdue-tasks"),
          })
        }

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
              title: "Overdue Payments",
              message: `${overduePayments.length} payment${overduePayments.length > 1 ? "s" : ""} past due date`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/admin/payments",
              linkText: "View Payments",
              read: readIds.has("overdue-payments"),
            })
          }
        } catch (e) {
          // Table might not exist, ignore
        }

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
              title: "Payments Due Soon",
              message: `${dueSoonPayments.length} payment${dueSoonPayments.length > 1 ? "s" : ""} due within 7 days`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/admin/payments",
              linkText: "View Payments",
              read: readIds.has("due-soon-payments"),
            })
          }
        } catch (e) {
          // Table might not exist, ignore
        }

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
              title: "Pending Leave Requests",
              message: `${pendingLeaveCount} leave request${pendingLeaveCount > 1 ? "s" : ""} awaiting approval`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/admin/hr/leave",
              linkText: "Review Requests",
              read: readIds.has("pending-leave"),
            })
          }
        } catch (e) {
          // Table might not exist, ignore
        }

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
              title: "Unresolved Asset Issues",
              message: `${assetIssuesCount} asset issue${assetIssuesCount > 1 ? "s" : ""} need attention`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/admin/assets/issues",
              linkText: "View Issues",
              read: readIds.has("asset-issues"),
            })
          }
        } catch (e) {
          // Table might not exist, ignore
        }

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
              title: "Assets in Maintenance",
              message: `${maintenanceCount} asset${maintenanceCount > 1 ? "s" : ""} currently in maintenance`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/admin/assets",
              linkText: "View Assets",
              read: readIds.has("assets-maintenance"),
            })
          }
        } catch (e) {
          // Table might not exist, ignore
        }
      } else {
        // User notifications
        // Pending tasks
        const { data: assignedTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", user.id)
          .in("status", ["pending", "in_progress"])

        if (assignedTasks && assignedTasks.length > 0) {
          const pendingTasks = assignedTasks.filter((t: any) => t.status === "pending")
          if (pendingTasks.length > 0) {
            notificationList.push({
              id: "pending-tasks",
              type: "info",
              title: "Pending Tasks",
              message: `${pendingTasks.length} pending task${pendingTasks.length > 1 ? "s" : ""} assigned to you`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/tasks",
              linkText: "View Tasks",
              read: readIds.has("pending-tasks"),
            })
          }

          // Urgent tasks
          const urgentTasks = assignedTasks.filter((t: any) => t.priority === "urgent")
          if (urgentTasks.length > 0) {
            notificationList.push({
              id: "urgent-tasks",
              type: "error",
              title: "Urgent Tasks",
              message: `${urgentTasks.length} urgent task${urgentTasks.length > 1 ? "s" : ""} need immediate attention`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/tasks",
              linkText: "View Tasks",
              read: readIds.has("urgent-tasks"),
            })
          }

          // Overdue tasks
          const today = new Date().toISOString().split("T")[0]
          const overdueTasks = assignedTasks.filter((t: any) => t.due_date && t.due_date < today)
          if (overdueTasks.length > 0) {
            notificationList.push({
              id: "overdue-tasks",
              type: "error",
              title: "Overdue Tasks",
              message: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} need to be completed`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/tasks",
              linkText: "View Tasks",
              read: readIds.has("overdue-tasks"),
            })
          }

          // Tasks due soon
          const threeDaysFromNow = new Date()
          threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
          const dueSoonTasks = assignedTasks.filter(
            (t: any) => t.due_date && t.due_date >= today && t.due_date <= threeDaysFromNow.toISOString().split("T")[0]
          )
          if (dueSoonTasks.length > 0) {
            notificationList.push({
              id: "due-soon-tasks",
              type: "warning",
              title: "Tasks Due Soon",
              message: `${dueSoonTasks.length} task${dueSoonTasks.length > 1 ? "s" : ""} due within 3 days`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/tasks",
              linkText: "View Tasks",
              read: readIds.has("due-soon-tasks"),
            })
          }
        }

        // User's pending leave requests
        try {
          const { count: myPendingLeave } = await supabase
            .from("leave_requests")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "pending")

          if (myPendingLeave && myPendingLeave > 0) {
            notificationList.push({
              id: "my-pending-leave",
              type: "info",
              title: "Leave Requests Pending",
              message: `${myPendingLeave} leave request${myPendingLeave > 1 ? "s" : ""} awaiting approval`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/hr/leave",
              linkText: "View Requests",
              read: readIds.has("my-pending-leave"),
            })
          }
        } catch (e) {
          // Table might not exist, ignore
        }

        // User's recently approved leave
        try {
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          const { count: approvedLeave } = await supabase
            .from("leave_requests")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "approved")
            .gte("updated_at", sevenDaysAgo.toISOString())

          if (approvedLeave && approvedLeave > 0) {
            notificationList.push({
              id: "approved-leave",
              type: "success",
              title: "Leave Approved",
              message: `${approvedLeave} leave request${approvedLeave > 1 ? "s" : ""} recently approved`,
              timestamp: formatRelativeTime(now.toISOString()),
              createdAt: now.toISOString(),
              link: "/hr/leave",
              linkText: "View Details",
              read: readIds.has("approved-leave"),
            })
          }
        } catch (e) {
          // Table might not exist, ignore
        }
      }

      setNotifications(notificationList)
      lastFetchRef.current = now
    } catch (error) {
      console.error("Error loading notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const newSet = new Set(Array.from(prev))
      newSet.add(id)
      return newSet
    })
  }

  const markAllAsRead = () => {
    setReadIds(new Set(Array.from(notifications.map((n) => n.id))))
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setReadIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  if (isLoading) {
    return null
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-muted relative h-10 w-10 rounded-full transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-5 w-5 animate-pulse items-center justify-center p-0 text-xs font-semibold"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 border-2 p-0 shadow-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="bg-muted/50 flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs font-medium">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {notifications.length > 0 && unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[400px]">
          {notifications.length > 0 ? (
            <div className="space-y-0.5 p-1.5">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type]
                const isRead = readIds.has(notification.id)

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group hover:bg-muted/50 relative cursor-pointer rounded-md border-l-2 px-3 py-2 transition-all duration-200",
                      notificationColors[notification.type],
                      isRead && "opacity-60"
                    )}
                    onClick={() => {
                      if (notification.link) {
                        markAsRead(notification.id)
                        setIsOpen(false)
                        router.push(notification.link)
                      }
                    }}
                  >
                    {/* Dismiss button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-destructive/10 absolute top-1.5 right-1.5 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        dismissNotification(notification.id)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>

                    <div className="flex items-center gap-2 pr-6">
                      {/* Icon */}
                      <div
                        className={cn(
                          "bg-background/50 shrink-0 rounded p-1.5",
                          notificationIconColors[notification.type]
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      {/* Content - Compact single/two row layout */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={cn("truncate text-sm font-medium", !isRead && "font-semibold")}>
                            {notification.title}
                          </h4>
                          {notification.timestamp && (
                            <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                              {notification.timestamp}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="text-muted-foreground flex-1 truncate text-xs">{notification.message}</p>
                          {notification.link && <span className="text-primary shrink-0 text-xs font-medium">→</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-16">
              <div className="bg-muted mb-4 rounded-full p-4">
                <Bell className="text-muted-foreground h-8 w-8 opacity-50" />
              </div>
              <p className="text-foreground mb-1 text-sm font-medium">No notifications</p>
              <p className="text-muted-foreground text-center text-xs">
                You're all caught up! We'll notify you when something important happens.
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="bg-muted/30 border-t p-2">
            <Link
              href={isAdmin ? "/admin/notification" : "/notification"}
              onClick={() => setIsOpen(false)}
              className="text-primary block w-full py-2 text-center text-xs font-medium hover:underline"
            >
              View all notifications →
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
