"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Bell,
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
  X,
  CheckCheck,
  Search,
  Filter,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"

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

export default function NotificationPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false)
      return
    }
    
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient()
      loadNotifications(supabase)
      
      // Set up polling every 30 seconds
      intervalRef.current = setInterval(() => {
        loadNotifications(supabase)
      }, 30000)
    }).catch((error) => {
      console.error("Error initializing Supabase client:", error)
      setIsLoading(false)
    })

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const loadNotifications = async (supabase: any) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      const notificationList: Notification[] = []
      const now = new Date()

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
        const overdueTasks = assignedTasks.filter(
          (t: any) => t.due_date && t.due_date < today
        )
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
          (t: any) =>
            t.due_date &&
            t.due_date >= today &&
            t.due_date <= threeDaysFromNow.toISOString().split("T")[0]
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

      setNotifications(notificationList)
    } catch (error) {
      console.error("Error loading notifications:", error)
      toast.error("Failed to load notifications")
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const newSet = new Set(Array.from(prev))
      newSet.add(id)
      return newSet
    })
  }

  const markAllAsRead = () => {
    setReadIds(new Set(Array.from(notifications.map((n) => n.id))))
    toast.success("All notifications marked as read")
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setReadIds((prev) => {
      const newSet = new Set(Array.from(prev))
      newSet.delete(id)
      return newSet
    })
    toast.success("Notification dismissed")
  }

  const filteredNotifications = notifications.filter((notification) => {
    const matchesSearch =
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType = typeFilter === "all" || notification.type === typeFilter

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "read" && readIds.has(notification.id)) ||
      (statusFilter === "unread" && !readIds.has(notification.id))

    return matchesSearch && matchesType && matchesStatus
  })

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-muted rounded"></div>
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-48"></div>
                <div className="h-4 bg-muted rounded w-64"></div>
              </div>
            </div>
            <div className="h-10 bg-muted rounded w-40"></div>
          </div>

          {/* Filters Skeleton */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="h-10 bg-muted rounded flex-1"></div>
                <div className="h-10 bg-muted rounded w-48"></div>
                <div className="h-10 bg-muted rounded w-48"></div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Skeleton */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-32"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bell className="h-8 w-8" />
              Notifications
            </h1>
            <p className="text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline">
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {filteredNotifications.length > 0 ? (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => {
            const Icon = notificationIcons[notification.type]
            const isRead = readIds.has(notification.id)

            return (
              <Card
                key={notification.id}
                className={cn(
                  "group relative border-l-4 transition-all duration-200 hover:shadow-md",
                  notificationColors[notification.type],
                  isRead && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  {/* Dismiss button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissNotification(notification.id)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>

                  <div className="flex items-center gap-3 pr-8">
                    {/* Icon */}
                    <div
                      className={cn(
                        "p-2 rounded-lg bg-background/50 shrink-0",
                        notificationIconColors[notification.type]
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={cn(
                            "font-medium text-sm truncate",
                            !isRead && "font-semibold"
                          )}
                        >
                          {notification.title}
                        </h4>
                        {notification.timestamp && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {notification.timestamp}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-xs text-muted-foreground truncate flex-1">
                          {notification.message}
                        </p>
                        {notification.link && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs shrink-0"
                            onClick={() => {
                              markAsRead(notification.id)
                              router.push(notification.link!)
                            }}
                          >
                            {notification.linkText || "View"} →
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!isRead && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-full" />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4 inline-block">
              <Bell className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No notifications found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "You're all caught up! We'll notify you when something important happens."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

