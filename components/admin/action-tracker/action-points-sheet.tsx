"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { DetailCallout } from "@/components/ui/detail-dialog"
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
  const total = department?.totalPoints ?? 0
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%")

  return (
    <DetailSheet
      wide
      flush
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
          ? `${department.completedPoints} of ${total} completed · ${department.inProgressPoints} in progress · ${department.notStartedPoints} not started`
          : "Update individual action point statuses."
      }
    >
      {department ? (
        <div className="bg-muted flex h-1 shrink-0 overflow-hidden" aria-hidden>
          <div className="bg-success" style={{ width: pct(department.completedPoints) }} />
          <div className="bg-info" style={{ width: pct(department.inProgressPoints) }} />
        </div>
      ) : null}

      <ol className="divide-border/60 min-h-0 flex-1 divide-y overflow-y-auto">
        {department?.tasks.map((task, index) => (
          <li key={task.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
            <span className="text-muted-foreground w-4 shrink-0 pt-0.5 text-xs tabular-nums">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug font-medium">{task.title}</p>
              {task.description ? (
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">{task.description}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className={`text-xs ${getDueDateClassName(task)}`}>Due {formatDueDate(task)}</span>
                {task.assignees?.length ? (
                  <span className="text-muted-foreground text-xs">
                    {task.assignees.map((person) => person.name).join(", ")}
                  </span>
                ) : null}
                {renderBlockerButton(task)}
              </div>
              {task.blocker_note ? (
                <div className="mt-2">
                  <DetailCallout tone="amber" label="Hindrance">
                    {task.blocker_note}
                  </DetailCallout>
                </div>
              ) : null}
            </div>
            <div className="w-28 shrink-0 sm:w-36">
              {canMutateTask(task) ? (
                <Select value={task.status} onValueChange={(next) => void onStatusChange(task.id, next)}>
                  <SelectTrigger className="h-8 text-xs">
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
                        <SelectTrigger className="h-8 text-xs opacity-70">
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
          </li>
        ))}
      </ol>
    </DetailSheet>
  )
}
