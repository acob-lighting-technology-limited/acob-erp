"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ActionTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  department: string
  due_date?: string
  week_number: number
  year: number
  original_week?: number
  work_item_number?: string
}

interface ActionTrackerCardGridProps {
  tasks: ActionTask[]
  canMutateTask: (task: ActionTask) => boolean
  onStatusChange: (taskId: string, newStatus: string) => void
  onEdit: (task: ActionTask) => void
  onDeleteRequest: (taskId: string) => void
  getDeptStatus: (dept: string) => { label: string; color: string }
  statusColor: (status: string) => string
}

export function ActionTrackerCardGrid({
  tasks,
  canMutateTask,
  onStatusChange,
  onEdit,
  onDeleteRequest,
  getDeptStatus,
  statusColor,
}: ActionTrackerCardGridProps) {
  if (tasks.length === 0) {
    return (
      <Card className="border-2">
        <CardContent className="p-12 text-center">
          <h3 className="text-foreground mb-2 text-xl font-semibold">No Actions Found</h3>
          <p className="text-muted-foreground">No action items match the current search and filters.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tasks.map((task) => {
        const deptStatus = getDeptStatus(task.department)
        return (
          <Card key={task.id} className="border-2">
            <CardHeader className="bg-muted/50 border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">{task.title}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">{task.department}</p>
                </div>
                <Badge className={cn("px-2.5 py-1 text-[10px] font-bold uppercase", deptStatus.color)}>
                  {deptStatus.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {task.description ? <p className="text-muted-foreground text-sm">{task.description}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase">Week</p>
                  <p className="text-foreground font-medium">
                    W{task.week_number}, {task.year}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase">Priority</p>
                  <p className="text-foreground font-medium capitalize">{task.priority.replace("_", " ")}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Status</p>
                <Select
                  value={task.status}
                  disabled={!canMutateTask(task)}
                  onValueChange={(value) => onStatusChange(task.id, value)}
                >
                  <SelectTrigger className={cn("h-9 w-full text-[11px] font-bold uppercase", statusColor(task.status))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(task)} disabled={!canMutateTask(task)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => onDeleteRequest(task.id)}
                  disabled={!canMutateTask(task)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
