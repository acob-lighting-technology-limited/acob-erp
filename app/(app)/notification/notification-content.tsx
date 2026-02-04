"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
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
  MessageSquare,
  FileText,
  Settings,
  AlertTriangle,
  Trash2,
  Archive,
  ChevronRight,
  Filter,
} from "lucide-react"
import type { Notification } from "./page"

// Type icons
const typeIcons = {
  task_assigned: User,
  task_updated: AlertCircle,
  task_completed: CheckCircle,
  mention: MessageSquare,
  feedback: MessageSquare,
  asset_assigned: Package,
  approval_request: FileText,
  approval_granted: CheckCircle,
  system: Settings,
  announcement: AlertTriangle,
}

// Priority colors
const priorityColors = {
  low: "text-gray-500",
  normal: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
}

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

function getInitials(name?: string): string {
  if (!name) return "?"
  const parts = name.split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

interface NotificationContentProps {
  initialNotifications: Notification[]
  userId: string
}

export function NotificationContent({ initialNotifications, userId }: NotificationContentProps) {
  const router = useRouter()
  const supabase = createClient()

  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("all")

  useEffect(() => {
    // Setup real-time subscription
    const subscription = supabase
      .channel("user_notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setNotifications((prev) => [payload.new as Notification, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setNotifications((prev) => prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n)))
          } else if (payload.eventType === "DELETE") {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, userId])

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)

      if (error) throw error

      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)))
    } catch (error: any) {
      console.error("Error marking as read:", error)
      toast.error("Failed to mark as read")
    }
  }

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc("mark_notifications_read", {
        p_user_id: userId,
        p_notification_ids: null,
      })

      if (error) throw error

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success("All notifications marked as read")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error("Failed to mark all as read")
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId)

      if (error) throw error

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      toast.success("Notification deleted")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error("Failed to delete notification")
    }
  }

  const archiveNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq("id", notificationId)

      if (error) throw error

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      toast.success("Notification archived")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error("Failed to archive notification")
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }

    await supabase
      .from("notifications")
      .update({ clicked: true, clicked_at: new Date().toISOString() })
      .eq("id", notification.id)

    if (notification.link_url) {
      router.push(notification.link_url)
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread" && n.read) return false
    if (activeTab !== "all" && activeTab !== "unread" && n.category !== activeTab) return false
    if (priorityFilter !== "all" && n.priority !== priorityFilter) return false

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query) ||
        n.actor_name?.toLowerCase().includes(query)
      )
    }

    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length
  const categoryCounts = {
    all: notifications.length,
    unread: unreadCount,
    tasks: notifications.filter((n) => n.category === "tasks").length,
    assets: notifications.filter((n) => n.category === "assets").length,
    feedback: notifications.filter((n) => n.category === "feedback").length,
    mentions: notifications.filter((n) => n.category === "mentions").length,
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Notifications"
        description="Stay updated with your tasks, assets, and more"
        icon={Bell}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
        actions={
          unreadCount > 0 ? (
            <Button onClick={markAllAsRead} variant="outline" className="gap-2">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
            <div className="text-2xl font-bold text-green-600">{categoryCounts.tasks}</div>
            <div className="text-muted-foreground text-xs">Tasks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{categoryCounts.assets}</div>
            <div className="text-muted-foreground text-xs">Assets</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="border-b">
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
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b">
            <TabsList className="h-auto w-full justify-start rounded-none border-b-0 bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:bg-transparent"
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
                className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:bg-transparent"
              >
                Unread
                {categoryCounts.unread > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {categoryCounts.unread}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="tasks"
                className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:bg-transparent"
              >
                <User className="mr-1 h-4 w-4" />
                Tasks
                {categoryCounts.tasks > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryCounts.tasks}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="assets"
                className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:bg-transparent"
              >
                <Package className="mr-1 h-4 w-4" />
                Assets
                {categoryCounts.assets > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryCounts.assets}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-[calc(100vh-400px)]">
              {filteredNotifications.length > 0 ? (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => {
                    const Icon = typeIcons[notification.type as keyof typeof typeIcons] || Info

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "group hover:bg-muted/30 relative cursor-pointer p-6 transition-all",
                          !notification.read && "bg-blue-50/30 dark:bg-blue-950/10"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {!notification.read && <div className="bg-primary absolute top-0 bottom-0 left-0 w-1" />}

                        <div className="flex gap-4 pl-2">
                          {notification.actor_avatar || notification.actor_name ? (
                            <Avatar className="h-12 w-12 shrink-0">
                              {notification.actor_avatar && (
                                <AvatarImage src={notification.actor_avatar} alt={notification.actor_name} />
                              )}
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {getInitials(notification.actor_name)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div
                              className={cn(
                                "bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                                priorityColors[notification.priority as keyof typeof priorityColors]
                              )}
                            >
                              <Icon className="h-6 w-6" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className={cn("text-base leading-snug", !notification.read && "font-semibold")}>
                                  {notification.title}
                                </h3>
                                <p className="text-muted-foreground mt-1 text-sm">{notification.message}</p>

                                <div className="mt-2 flex items-center gap-4">
                                  <span className="text-muted-foreground text-xs">
                                    {formatRelativeTime(notification.created_at)}
                                  </span>
                                  {notification.actor_name && (
                                    <>
                                      <span className="text-muted-foreground">•</span>
                                      <span className="text-muted-foreground text-xs">
                                        by {notification.actor_name}
                                      </span>
                                    </>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {notification.category}
                                  </Badge>
                                </div>

                                {notification.link_url && (
                                  <div className="text-primary mt-2 flex items-center gap-1 text-sm font-medium">
                                    View details
                                    <ChevronRight className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                >
                                  <CheckCheck className="mr-1 h-4 w-4" />
                                  Mark read
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  archiveNotification(notification.id)
                                }}
                              >
                                <Archive className="mr-1 h-4 w-4" />
                                Archive
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteNotification(notification.id)
                                }}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
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
                      : "You're all caught up! We'll notify you when something important happens."}
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </PageWrapper>
  )
}
