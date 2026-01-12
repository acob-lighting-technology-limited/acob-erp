"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  MoreHorizontal,
  Eye,
  Trash2,
  Filter,
} from "lucide-react"
import Link from "next/link"
import type { CRMActivity } from "@/types/crm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const activityIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: Activity,
  task: CheckCircle,
  follow_up: Clock,
}

const activityColors: Record<string, string> = {
  call: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  email: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
  meeting: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  note: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  task: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  follow_up: "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
}

const priorityColors: Record<string, string> = {
  urgent: "text-red-600 bg-red-100",
  high: "text-orange-600 bg-orange-100",
  normal: "text-blue-600 bg-blue-100",
  low: "text-gray-600 bg-gray-100",
}

interface ActivitiesContentProps {
  initialActivities: CRMActivity[]
  initialTotalCount: number
}

export function ActivitiesContent({ initialActivities, initialTotalCount }: ActivitiesContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activities, setActivities] = useState<CRMActivity[]>(initialActivities)
  const [isLoading, setIsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(initialTotalCount)

  const [typeFilter, setTypeFilter] = useState("all")
  const [completedFilter, setCompletedFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  // Refetch when filters change (not on initial mount)
  useEffect(() => {
    if (typeFilter !== "all" || completedFilter !== "all" || priorityFilter !== "all") {
      loadActivities()
    }
  }, [typeFilter, completedFilter, priorityFilter])

  const loadActivities = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      params.set("limit", "50")

      if (typeFilter !== "all") params.set("type", typeFilter)
      if (completedFilter !== "all") params.set("completed", completedFilter)
      if (priorityFilter !== "all") params.set("priority", priorityFilter)

      const response = await fetch(`/api/crm/activities?${params}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setActivities(data.data || [])
      setTotalCount(data.count || 0)
    } catch (error: any) {
      console.error("Error loading activities:", error)
      toast.error("Failed to load activities")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleComplete = async (activity: CRMActivity) => {
    try {
      const response = await fetch(`/api/crm/activities/${activity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !activity.completed }),
      })

      if (!response.ok) throw new Error("Failed to update")

      toast.success(activity.completed ? "Marked as incomplete" : "Marked as complete")
      loadActivities()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this activity?")) return

    try {
      const response = await fetch(`/api/crm/activities/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete")
      toast.success("Activity deleted")
      loadActivities()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const now = new Date()
  const today = now.toISOString().split("T")[0]

  const overdueActivities = activities.filter((a) => !a.completed && a.due_date && a.due_date < today)
  const todayActivities = activities.filter((a) => a.due_date === today && !a.completed)
  const upcomingActivities = activities.filter((a) => !a.completed && a.due_date && a.due_date > today)
  const completedActivities = activities.filter((a) => a.completed)

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }

  const ActivityCard = ({ activity }: { activity: CRMActivity }) => {
    const Icon = activityIcons[activity.type] || Activity
    const isOverdue = !activity.completed && activity.due_date && activity.due_date < today

    return (
      <div
        className={`bg-card flex items-start gap-4 rounded-lg border p-4 ${isOverdue ? "border-red-300 dark:border-red-800" : ""}`}
      >
        <Checkbox
          checked={activity.completed}
          onCheckedChange={() => handleToggleComplete(activity)}
          className="mt-1"
        />

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${activityColors[activity.type] || "bg-gray-100"}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`font-medium ${activity.completed ? "text-muted-foreground line-through" : ""}`}>
                {activity.subject}
              </p>
              {activity.description && (
                <p className="text-muted-foreground line-clamp-1 text-sm">{activity.description}</p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/admin/crm/activities/${activity.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(activity.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {activity.contact && (
              <span className="text-muted-foreground">
                {activity.contact.contact_name}
                {activity.contact.company_name && ` • ${activity.contact.company_name}`}
              </span>
            )}
            {activity.due_date && (
              <Badge variant="outline" className={isOverdue ? "border-red-500 text-red-500" : ""}>
                {new Date(activity.due_date).toLocaleDateString()}
              </Badge>
            )}
            <Badge variant="secondary" className={priorityColors[activity.priority] || ""}>
              {activity.priority}
            </Badge>
            <Badge variant="outline">{activity.type}</Badge>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activities</h1>
          <p className="text-muted-foreground">Track calls, emails, meetings, and tasks</p>
        </div>
        <Link
          href="/admin/crm/activities/new"
          className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          Log Activity
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueActivities.length}</p>
              <p className="text-muted-foreground text-xs">Overdue</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-950">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayActivities.length}</p>
              <p className="text-muted-foreground text-xs">Due Today</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingActivities.length}</p>
              <p className="text-muted-foreground text-xs">Upcoming</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedActivities.length}</p>
              <p className="text-muted-foreground text-xs">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="call">Calls</SelectItem>
                <SelectItem value="email">Emails</SelectItem>
                <SelectItem value="meeting">Meetings</SelectItem>
                <SelectItem value="task">Tasks</SelectItem>
                <SelectItem value="note">Notes</SelectItem>
                <SelectItem value="follow_up">Follow-ups</SelectItem>
              </SelectContent>
            </Select>

            <Select value={completedFilter} onValueChange={setCompletedFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="false">Pending</SelectItem>
                <SelectItem value="true">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
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
        </CardContent>
      </Card>

      {/* Activities List */}
      <div className="space-y-6">
        {/* Overdue */}
        {overdueActivities.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-red-600">
              <AlertCircle className="h-5 w-5" />
              Overdue ({overdueActivities.length})
            </h2>
            <div className="space-y-2">
              {overdueActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}

        {/* Today */}
        {todayActivities.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5" />
              Today ({todayActivities.length})
            </h2>
            <div className="space-y-2">
              {todayActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcomingActivities.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5" />
              Upcoming ({upcomingActivities.length})
            </h2>
            <div className="space-y-2">
              {upcomingActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completedActivities.length > 0 && completedFilter !== "false" && (
          <div>
            <h2 className="text-muted-foreground mb-3 flex items-center gap-2 text-lg font-semibold">
              <CheckCircle className="h-5 w-5" />
              Completed ({completedActivities.length})
            </h2>
            <div className="space-y-2">
              {completedActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activities.length === 0 && (
          <div className="py-12 text-center">
            <Activity className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
            <h3 className="mb-1 font-medium">No activities found</h3>
            <p className="text-muted-foreground mb-4 text-sm">Start tracking your customer interactions</p>
            <Link
              href="/admin/crm/activities/new"
              className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              Log First Activity
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
