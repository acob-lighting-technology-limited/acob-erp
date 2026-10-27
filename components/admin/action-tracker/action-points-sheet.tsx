"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { DetailCallout, DetailSectionHeading } from "@/components/ui/detail-dialog"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatDueDate,
  getDueDateClassName,
  getSummaryBadgeClass,
  type DepartmentSummaryStatus,
} from "@/lib/reports/action-tracker-display"

export interface ActionPointTask {
  id: string
  title: string
  description?: string
  status: string
  department: string
  due_date?: string | null
  week_number: number
  year: number
  origin?: string
  assignees?: { id: string; name: string }[]
  blocker_note?: string
}

export interface ActionPointsDepartment<T extends ActionPointTask = ActionPointTask> {
  department: string
  tasks: T[]
  totalPoints: number
  completedPoints: number
  inProgressPoints: number
  notStartedPoints: number
  summaryStatus: DepartmentSummaryStatus
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
]

/** Why a status control is locked, shown on hover. */
export function getDisabledEditReason(task: Pick<ActionPointTask, "department" | "origin" | "assignees">) {
  if (task.origin === "management_directive" && (task.assignees || []).length > 0) {
    return `Only assigned staff or members of ${task.department} can update this directive`
  }
  return `Only members or leads of ${task.department} can update this status`
}

interface ActionPointsSheetProps<T extends ActionPointTask> {
  /** The department whose points are listed; null closes the sheet. */
  department: ActionPointsDepartment<T> | null
  week: number
  year: number
  onClose: () => void
  canMutateTask: (task: T) => boolean
  onStatusChange: (taskId: string, status: string) => void | Promise<void>
  /** The page's "report a hindrance" control, which opens the page's own blocker dialog. */
  renderBlockerButton: (task: T) => ReactNode
}

/**
 * The one place a department's action points are listed and their statuses changed, shared by the
 * staff and admin action trackers. Before this each page had its own copy and they had drifted: only
 * one showed the hindrance note and only one explained why a status was locked.
 */
export function ActionPointsSheet<T extends ActionPointTask>({
  department,
  week,
  year,
  onClose,
  canMutateTask,
  onStatusChange,
  renderBlockerButton,
}: ActionPointsSheetProps<T>) {
  return (
    <DetailSheet
      wide
      open={Boolean(department)}
      onOpenChange={(open) => !open && onClose()}
      title={department?.department || "Department"}
      badges={
        department ? (
          <>
            <Badge className={`${getSummaryBadgeClass(department.summaryStatus)} text-xs`}>
              {department.summaryStatus}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Week {week} · {year}
            </Badge>
          </>
        ) : null
      }
      description={
        department
          ? `${department.completedPoints} of ${department.totalPoints} action points completed · ${department.inProgressPoints} in progress · ${department.notStartedPoints} not started`
          : "Update individual action point statuses."
      }
    >
      {department?.tasks.map((task, index) => (
        <section key={task.id} className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <DetailSectionHeading>{`${index + 1}. ${task.title}`}</DetailSectionHeading>
              {task.description ? (
                <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              ) : null}
            </div>
            <div className="w-full sm:w-44">
              {canMutateTask(task) ? (
                <Select value={task.status} onValueChange={(next) => void onStatusChange(task.id, next)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block w-full cursor-not-allowed">
                      <Select value={task.status} disabled>
                        <SelectTrigger className="h-9 text-sm opacity-70">
                          <SelectValue />
                        </SelectTrigger>
                      </Select>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{getDisabledEditReason(task)}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {task.blocker_note ? (
            <DetailCallout tone="amber" label="Hindrance">
              {task.blocker_note}
            </DetailCallout>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs ${getDueDateClassName(task)}`}>Due {formatDueDate(task)}</span>
            {renderBlockerButton(task)}
          </div>
        </section>
      ))}
    </DetailSheet>
  )
}
