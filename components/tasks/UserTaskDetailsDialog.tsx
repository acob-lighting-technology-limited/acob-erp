"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/patterns"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import {
  Users,
  Building2,
  MessageSquare,
  Send,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  HeadphonesIcon,
} from "lucide-react"
import { formatName } from "@/lib/utils"
import type { Task } from "@/app/(app)/tasks/management/tasks-content"

interface TaskUpdate {
  id: string
  content?: string
  update_type: string
  created_at: string
  user?: {
    first_name: string
    last_name: string
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4" />
    case "in_progress":
      return <TrendingUp className="h-4 w-4" />
    case "pending":
      return <Clock className="h-4 w-4" />
    case "cancelled":
      return <AlertCircle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface UserTaskDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedTask: Task | null
  taskUpdates: TaskUpdate[]
  newComment: string
  setNewComment: (value: string) => void
  newStatus: string
  isSaving: boolean
  onAddComment: () => Promise<void>
  onMarkAsDone: () => Promise<void>
  onUpdateStatus: (status: string) => Promise<void>
}

export function UserTaskDetailsDialog({
  open,
  onOpenChange,
  selectedTask,
  taskUpdates,
  newComment,
  setNewComment,
  newStatus,
  isSaving,
  onAddComment,
  onMarkAsDone,
  onUpdateStatus,
}: UserTaskDetailsDialogProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Task Details"
      description="Review progress, update status, and leave a clear handover trail."
      desktopClassName="max-w-4xl"
    >
      {selectedTask && (
        <div className="space-y-6">
          <Card className="border">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                {selectedTask.work_item_number && (
                  <div className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
                    {selectedTask.work_item_number}
                  </div>
                )}
                <div className="text-foreground text-2xl font-semibold">{selectedTask.title}</div>
                {selectedTask.description && (
                  <p className="text-muted-foreground max-w-3xl text-sm leading-6">{selectedTask.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge className={getStatusColor(selectedTask.status)}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(selectedTask.status)}
                    {selectedTask.status.replace("_", " ")}
                  </span>
                </Badge>
                <Badge className={getPriorityColor(selectedTask.priority)}>{selectedTask.priority} priority</Badge>
                {selectedTask.department && <Badge variant="outline">{selectedTask.department}</Badge>}
                {selectedTask.source_type === "help_desk" && (
                  <Badge variant="outline" className="gap-1">
                    <HeadphonesIcon className="h-3 w-3" />
                    Help Desk
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              {selectedTask.assignment_type === "multiple" && selectedTask.assigned_users && (
                <Card className="bg-muted/30 border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      Group Task
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {selectedTask.assigned_users.map((user) => (
                        <div key={user.id} className="bg-background flex items-center justify-between rounded-md p-2">
                          <span className="text-sm">
                            {formatName(user.first_name)} {formatName(user.last_name)}
                          </span>
                          {user.completed ? (
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            >
                              Done
                            </Badge>
                          ) : (
                            <Badge variant="outline">In Progress</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-muted-foreground border-t pt-2 text-xs">
                      {selectedTask.assigned_users.filter((user) => user.completed).length} of{" "}
                      {selectedTask.assigned_users.length} completed
                    </div>
                    {!selectedTask.user_completed && (
                      <Button onClick={onMarkAsDone} disabled={isSaving} className="w-full gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Myself as Done
                      </Button>
                    )}
                    {selectedTask.user_completed && (
                      <div className="rounded-md bg-green-100 p-2 text-center text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        You&apos;ve marked this task as done.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedTask.assignment_type === "department" && (
                <Card className="bg-muted/30 border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4" />
                      Department Task
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm leading-6">
                      This task is assigned to the <strong>{selectedTask.department}</strong> department.
                    </p>
                    {!selectedTask.can_change_status && (
                      <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                        Only department leads, admins, and super admins can change the status.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="bg-muted/30 border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Update Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={newStatus}
                    onValueChange={onUpdateStatus}
                    disabled={
                      isSaving ||
                      selectedTask.assignment_type === "multiple" ||
                      (selectedTask.assignment_type === "department" && !selectedTask.can_change_status)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedTask.assignment_type === "multiple" && (
                    <p className="text-muted-foreground text-xs">
                      For group tasks, mark yourself as done instead of changing the whole task status.
                    </p>
                  )}
                  {selectedTask.assignment_type === "department" && !selectedTask.can_change_status && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Only department leads, admins, and super admins can change the status of department tasks.
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    If you add a note below before changing status, it will be saved with the status update.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-muted/30 border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Comment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    placeholder="Add a comment or progress note..."
                    className="min-h-[120px]"
                  />
                  <Button onClick={onAddComment} disabled={isSaving || !newComment.trim()} className="gap-2">
                    <Send className="h-4 w-4" />
                    Post Comment
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taskUpdates.length > 0 ? (
                <div className="space-y-4">
                  {taskUpdates.map((update) => (
                    <div key={update.id} className="flex gap-3 border-b pb-4 last:border-0">
                      <div className="flex-1">
                        {update.user && (
                          <p className="text-foreground text-sm font-medium">
                            {update.user.first_name} {update.user.last_name}
                          </p>
                        )}
                        <p className="text-muted-foreground text-sm">{update.content}</p>
                        <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(update.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No updates yet"
                  description="Task comments and status changes will appear here."
                  icon={MessageSquare}
                  className="border-0 p-4"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </ResponsiveModal>
  )
}
