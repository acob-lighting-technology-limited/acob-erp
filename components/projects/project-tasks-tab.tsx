"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardList } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/ui/patterns"

interface TaskUser {
  first_name: string
  last_name: string
}

interface ProjectTask {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  progress: number
  due_date?: string
  task_start_date?: string
  task_end_date?: string
  assigned_to_user: TaskUser
}

interface ProjectTasksTabProps {
  tasks: ProjectTask[]
  getStatusColor: (status: string) => string
  getPriorityColor: (priority: string) => string
  formatDate: (dateString: string) => string
}

export function ProjectTasksTab({ tasks, getStatusColor, getPriorityColor, formatDate }: ProjectTasksTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Tasks</CardTitle>
        <CardDescription>Tasks associated with this project</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks assigned to this project yet"
            description="Task assignments linked to this project will appear here."
            icon={ClipboardList}
            className="border-0"
          />
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Link key={task.id} href={`/tasks`}>
                <div className="hover:bg-accent cursor-pointer rounded-lg border p-3 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="font-medium">{task.title}</p>
                        <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                        <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      </div>
                      {task.description && (
                        <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Assigned to:{" "}
                          <span className="text-foreground font-medium">
                            {task.assigned_to_user.first_name} {task.assigned_to_user.last_name}
                          </span>
                        </span>
                        {task.task_start_date && task.task_end_date && (
                          <span className="text-muted-foreground">
                            {formatDate(task.task_start_date)} - {formatDate(task.task_end_date)}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          Progress: <span className="text-foreground font-medium">{task.progress}%</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
