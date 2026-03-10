"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { PageHeader, PageWrapper } from "@/components/layout"
import {
  Bell,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  CheckCheck,
  User,
  Package,
  AlertTriangle,
  Clock,
  ChevronRight,
  Filter,
  CreditCard,
  CalendarClock,
  RefreshCw,
  Mail,
  Megaphone,
  Settings,
} from "lucide-react"

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
  info: "bg-blue-50/50 dark:bg-blue-950/10",
  warning: "bg-yellow-50/50 dark:bg-yellow-950/10",
  success: "bg-green-50/50 dark:bg-green-950/10",
  error: "bg-red-50/50 dark:bg-red-950/10",
}

// Format relative time
interface AdminNotificationContentProps {
  initialNotifications: DynamicNotification[]
}

export function AdminNotificationContent({ initialNotifications }: AdminNotificationContentProps) {
  const router = useRouter()

  const [notifications, setNotifications] = useState<DynamicNotification[]>(initialNotifications)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setNotifications(initialNotifications)
  }, [initialNotifications])

  // Reload notifications
  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      router.refresh()
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
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Admin Notifications"
        description="System-wide notifications and alerts"
        icon={Bell}
        backLink={{ href: "/admin", label: "Back to Admin" }}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/settings/mail">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Notification Settings
              </Button>
            </Link>
            <Link href="/admin/communications/meetings">
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Meetings
              </Button>
            </Link>
            <Link href="/admin/communications/broadcast">
              <Button variant="outline" className="gap-2">
                <Megaphone className="h-4 w-4" />
                Broadcast
              </Button>
            </Link>
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
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 md:gap-4 lg:grid-cols-8">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold sm:text-2xl">{categoryCounts.all}</div>
            <div className="text-muted-foreground text-xs">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold text-blue-600 sm:text-2xl">{categoryCounts.unread}</div>
            <div className="text-muted-foreground text-xs">Unread</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold text-orange-600 sm:text-2xl">{categoryCounts.users}</div>
            <div className="text-muted-foreground text-xs">Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold text-green-600 sm:text-2xl">{categoryCounts.tasks}</div>
            <div className="text-muted-foreground text-xs">Tasks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold text-red-600 sm:text-2xl">{categoryCounts.payments}</div>
            <div className="text-muted-foreground text-xs">Payments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold text-purple-600 sm:text-2xl">{categoryCounts.leave}</div>
            <div className="text-muted-foreground text-xs">Leave</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold text-indigo-600 sm:text-2xl">{categoryCounts.assets}</div>
            <div className="text-muted-foreground text-xs">Assets</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-lg font-bold text-teal-600 sm:text-2xl">{categoryCounts.feedback}</div>
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
          <div className="border-b px-4 py-3">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="all" className="px-3 py-1.5 whitespace-nowrap">
                All
                {categoryCounts.all > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryCounts.all}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="unread" className="px-3 py-1.5 whitespace-nowrap">
                Unread
                {categoryCounts.unread > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {categoryCounts.unread}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="payments" className="px-3 py-1.5 whitespace-nowrap">
                <CreditCard className="mr-1 h-4 w-4" />
                Payments
                {categoryCounts.payments > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryCounts.payments}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="leave" className="px-3 py-1.5 whitespace-nowrap">
                <CalendarClock className="mr-1 h-4 w-4" />
                Leave
                {categoryCounts.leave > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryCounts.leave}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="tasks" className="px-3 py-1.5 whitespace-nowrap">
                <Clock className="mr-1 h-4 w-4" />
                Tasks
                {categoryCounts.tasks > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryCounts.tasks}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="assets" className="px-3 py-1.5 whitespace-nowrap">
                <Package className="mr-1 h-4 w-4" />
                Assets
                {categoryCounts.assets > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryCounts.assets}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="users" className="px-3 py-1.5 whitespace-nowrap">
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
                          "group hover:bg-muted/30 relative flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-all",
                          typeColors[notification.type],
                          isRead && "opacity-60"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            notification.type === "error"
                              ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                              : notification.type === "warning"
                                ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400"
                                : notification.type === "success"
                                  ? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
                                  : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        {/* Content */}
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("truncate text-sm leading-tight", !isRead && "font-semibold")}>
                                {notification.title}
                              </span>
                              <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                                - {notification.message}
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
    </PageWrapper>
  )
}
