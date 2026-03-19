"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/patterns"
import { Users, Building2, MessageSquare, Send, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react"
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {selectedTask && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedTask.title}</DialogTitle>
              <DialogDescription>{selectedTask.description}</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-6">
              {/* Status and Priority */}
              <div className="flex flex-wrap gap-3">
                <Badge className={getStatusColor(selectedTask.status)}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(selectedTask.status)}
                    {selectedTask.status.replace("_", " ")}
                  </span>
                </Badge>
                <Badge className={getPriorityColor(selectedTask.priority)}>{selectedTask.priority} priority</Badge>
                {selectedTask.department && <Badge variant="outline">{selectedTask.department}</Badge>}
              </div>

              {/* Group Task Info */}
              {selectedTask.assignment_type === "multiple" && selectedTask.assigned_users && (
                <Card className="bg-muted/30 border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      Group Task - Assigned People
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
                      {selectedTask.assigned_users.filter((u) => u.completed).length} of{" "}
                      {selectedTask.assigned_users.length} completed
                    </div>
                    {!selectedTask.user_completed && (
                      <Button onClick={onMarkAsDone} disabled={isSaving} className="w-full gap-2" variant="default">
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Myself as Done
                      </Button>
                    )}
                    {selectedTask.user_completed && (
                      <div className="rounded-md bg-green-100 p-2 text-center text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        ✓ You&apos;ve marked this task as done
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Department Task Info */}
              {selectedTask.assignment_type === "department" && (
                <Card className="bg-muted/30 border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4" />
                      Department Task
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      This task is assigned to the <strong>{selectedTask.department}</strong> department.
                      {!selectedTask.can_change_status && (
                        <span className="mt-2 block text-xs text-yellow-600 dark:text-yellow-400">
                          Only department leads, admins, and super admins can change the status.
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Update Status */}
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
                    </SelectContent>
                  </Select>
                  {selectedTask.assignment_type === "multiple" && (
                    <p className="text-muted-foreground text-xs">
                      For group tasks, mark yourself as done above instead of changing the status.
                    </p>
                  )}
                  {selectedTask.assignment_type === "department" && !selectedTask.can_change_status && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Only department leads, admins, and super admins can change the status of department tasks.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Add Comment */}
              <Card className="bg-muted/30 border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Comment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment or update about this task..."
                    className="min-h-[100px]"
                  />
                  <Button onClick={onAddComment} disabled={isSaving || !newComment.trim()} className="gap-2">
                    <Send className="h-4 w-4" />
                    Post Comment
                  </Button>
                </CardContent>
              </Card>

              {/* Activity Timeline */}
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
                      description="Task comments and status updates will appear here."
                      icon={MessageSquare}
                      className="border-0 p-4"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
