"use client"

import { useState, type ReactNode } from "react"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import type { Task } from "@/types/task"
import { TaskStatusControl } from "@/components/tasks/TaskStatusControl"
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/lib/tasks/constants"
import { statusLabel } from "@/components/tasks/TaskStatusControl"
import { formatWATDateTime, formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { isTaskOverdue } from "@/lib/tasks/overdue"
import { cn, formatFullName } from "@/lib/utils"
import { TASK_WEIGHT_DEFAULT, getTaskWeightBadgeClass } from "@/lib/tasks/scoring"
import {
  DetailBody,
  DetailActionBar,
  DetailCallout,
  DetailComposer,
  DetailProperties,
  DetailProperty,
  DetailSectionHeading,
  DetailTimeline,
  DetailTimelineEntry,
} from "@/components/ui/detail-dialog"

interface TaskUpdate {
  id: string
  content?: string
  update_type: string
  created_at: string
  old_value?: string | null
  new_value?: string | null
  user?: {
    first_name: string
    last_name: string
  }
}

type TaskTimelineEntry = {
  key: string
  at: string
  title: ReactNode
  body?: ReactNode
}

interface UserTaskDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedTask: Task | null
  taskUpdates: TaskUpdate[]
  /** True when this user may approve, rate, reject or reassign the task. */
  canReview?: boolean
  /** Why this user may not approve and rate the task, when they may not. */
  ratingBlockedReason?: string | null
  /** Called after a status change so the list behind the dialog refreshes. */
  onChanged?: () => void | Promise<void>
  /** Posts a comment and refreshes taskUpdates. */
  onAddComment?: (content: string) => Promise<void>
  isPostingComment?: boolean
}

/** One sentence telling the viewer what the task needs from them now, given its status and their role. */
function nextStepFor(status: string, canReview: boolean, ratingBlockedReason: string | null) {
  switch (status) {
    case "pending":
      return "Start the task, then post progress updates below as you go."
    case "in_progress":
      return "Post progress updates below. When the work is done, submit it for review."
    case "submitted_for_review":
      if (!canReview) return "Submitted. Waiting for a lead or admin to review and rate it."
      return ratingBlockedReason ?? "Review the work: approve and rate it, or send it back with a reason."
    case "unable_to_complete":
      return canReview
        ? "A blocker was reported. Decide whether to reopen, reassign or close it."
        : "Blocker reported. Waiting for a lead or admin to decide."
    default:
      return "This task is closed. Nothing further is needed."
  }
}

export function UserTaskDetailsDialog({
  open,
  onOpenChange,
  selectedTask,
  taskUpdates,
  canReview = false,
  ratingBlockedReason = null,
  onChanged,
  onAddComment,
  isPostingComment = false,
}: UserTaskDetailsDialogProps) {
  const [commentDraft, setCommentDraft] = useState("")

  if (!selectedTask) return null

  const isOverdue = isTaskOverdue(selectedTask, toLocalISODate())

  const assignedByName = selectedTask.assigned_by_user
    ? formatFullName(selectedTask.assigned_by_user.first_name, selectedTask.assigned_by_user.last_name)
    : "System"

  const assignedToName = selectedTask.assigned_to_user
    ? formatFullName(selectedTask.assigned_to_user.first_name, selectedTask.assigned_to_user.last_name)
    : "Nobody"

  const dueLabel = selectedTask.due_date ? formatWATDate(selectedTask.due_date) : "No deadline"
  const startLabel = selectedTask.task_start_date ? formatWATDate(selectedTask.task_start_date) : null
  const endSource = selectedTask.task_end_date || selectedTask.due_date
  const isClosed = ["completed", "reassigned", "failed", "cancelled"].includes(selectedTask.status)
  const activity: TaskTimelineEntry[] = (() => {
    const entries: TaskTimelineEntry[] = [
      {
        key: "assigned",
        at: selectedTask.created_at,
        title: <span className="font-medium">Assigned</span>,
        body: `To ${assignedToName}`,
      },
      ...taskUpdates.map((update) => {
        const actor = update.user ? formatFullName(update.user.first_name, update.user.last_name) : "System"
        const nextStatus = update.new_value as TaskStatus | null
        const config = nextStatus ? TASK_STATUS_CONFIG[nextStatus] : null

        if (update.update_type === "status_change" && nextStatus && config) {
          return {
            key: update.id,
            at: update.created_at,
            title: (
              <Badge variant={config.badgeVariant} className={cn("text-xs font-medium", config.color)}>
                {statusLabel(nextStatus)}
              </Badge>
            ),
            body: update.content ? `${actor} · ${update.content}` : actor,
          }
        }

        return {
          key: update.id,
          at: update.created_at,
          title: <span className="font-medium">{actor}</span>,
          body: update.content || "Added an update",
        }
      }),
    ]

    const hasRecordedTerminalStatus = taskUpdates.some(
      (update) => update.update_type === "status_change" && update.new_value === selectedTask.status
    )
    if (!hasRecordedTerminalStatus && ["completed", "failed", "cancelled"].includes(selectedTask.status)) {
      const terminalStatus = selectedTask.status as TaskStatus
      const config = TASK_STATUS_CONFIG[terminalStatus]
      entries.push({
        key: `terminal-${selectedTask.id}`,
        at: selectedTask.reviewed_at || selectedTask.completed_at || selectedTask.updated_at || selectedTask.created_at,
        title: (
          <Badge variant={config.badgeVariant} className={cn("text-xs font-medium", config.color)}>
            {statusLabel(terminalStatus)}
          </Badge>
        ),
        body: selectedTask.reviewed_by_user
          ? `${formatFullName(selectedTask.reviewed_by_user.first_name, selectedTask.reviewed_by_user.last_name)}${
              selectedTask.rating ? ` · ${selectedTask.rating}/5` : ""
            }`
          : undefined,
      })
    }

    return entries.sort((left, right) => left.at.localeCompare(right.at))
  })()

  return (
    <DetailSheet
      wide
      flush
      open={open}
      onOpenChange={onOpenChange}
      title={selectedTask.title}
      badges={
        <>
          {selectedTask.work_item_number && (
            <Badge variant="outline" className="font-mono text-xs">
              {selectedTask.work_item_number}
            </Badge>
          )}
          {(() => {
            const cfg = TASK_STATUS_CONFIG[selectedTask.status as TaskStatus] || TASK_STATUS_CONFIG.pending
            return (
              <Badge variant={cfg.badgeVariant} className={cn("text-xs capitalize", cfg.color)}>
                {cfg.label}
              </Badge>
            )
          })()}
          <Badge
            variant="outline"
            className={cn("font-mono text-xs font-medium", getTaskWeightBadgeClass(selectedTask.weight))}
          >
            Weight {selectedTask.weight ?? TASK_WEIGHT_DEFAULT}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
        </>
      }
      description={
        <>
          <span>Assigned by {assignedByName}</span>
          {selectedTask.department && (
            <>
              <span aria-hidden>·</span>
              <span>{selectedTask.department}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className={isOverdue ? "text-destructive font-medium" : undefined}>Due {dueLabel}</span>
        </>
      }
      toolbar={
        !isClosed ? (
          <DetailActionBar label="Next step" hint={nextStepFor(selectedTask.status, canReview, ratingBlockedReason)}>
            <TaskStatusControl
              task={selectedTask}
              canReview={canReview}
              ratingBlockedReason={ratingBlockedReason}
              onChanged={() => onChanged?.()}
            />
          </DetailActionBar>
        ) : undefined
      }
    >
      <DetailBody>
        {/* Anything that needs answering comes before the reference data. */}
        {(selectedTask.unable_to_complete_reason || selectedTask.failure_reason || selectedTask.extension_reason) && (
          <div className="space-y-2">
            {selectedTask.unable_to_complete_reason && (
              <DetailCallout tone="amber" label="Reported blocker">
                {selectedTask.unable_to_complete_reason}
              </DetailCallout>
            )}
            {selectedTask.failure_reason && (
              <DetailCallout tone="rose" label="Failure note">
                {selectedTask.failure_reason}
              </DetailCallout>
            )}
            {selectedTask.extension_reason && (
              <DetailCallout tone="blue" label="Extension granted for">
                {selectedTask.extension_reason}
              </DetailCallout>
            )}
          </div>
        )}

        {selectedTask.description && (
          <section className="space-y-2">
            <DetailSectionHeading>What was asked for</DetailSectionHeading>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
          </section>
        )}

        <section className="space-y-3">
          <DetailSectionHeading count={activity.length}>Timeline</DetailSectionHeading>
          {onAddComment && !isClosed && (
            <DetailComposer
              value={commentDraft}
              onChange={setCommentDraft}
              busy={isPostingComment}
              onSubmit={async () => {
                await onAddComment(commentDraft.trim())
                setCommentDraft("")
              }}
            />
          )}
          {activity.length > 0 ? (
            <DetailTimeline>
              {activity.map((entry) => (
                <DetailTimelineEntry key={entry.key} title={entry.title} timestamp={formatWATDateTime(entry.at)}>
                  {entry.body}
                </DetailTimelineEntry>
              ))}
            </DetailTimeline>
          ) : (
            <p className="text-muted-foreground text-sm">No task history recorded.</p>
          )}
        </section>

        <section className="space-y-2">
          <DetailSectionHeading>Task details</DetailSectionHeading>
          <DetailProperties>
            <DetailProperty label="Assigned to">{assignedToName}</DetailProperty>
            <DetailProperty label="Period">
              {startLabel || "—"} to {endSource ? formatWATDate(endSource) : "no deadline"}
            </DetailProperty>
            <DetailProperty label="Strategic goal">{selectedTask.goal_title}</DetailProperty>
            <DetailProperty label="Corporate KPI">
              {selectedTask.kpi_measure ? (
                <>
                  {selectedTask.kpi_measure}
                  {selectedTask.kpi_pillar && (
                    <span className="text-muted-foreground mt-0.5 block text-xs">{selectedTask.kpi_pillar}</span>
                  )}
                </>
              ) : null}
            </DetailProperty>
            <DetailProperty label="Rating">
              {selectedTask.rating ? `${selectedTask.rating} / 5` : "Not yet rated"}
            </DetailProperty>
            <DetailProperty label="Created">{formatWATDateTime(selectedTask.created_at)}</DetailProperty>
            {selectedTask.reviewed_by_user && (
              <DetailProperty label="Reviewed by">
                {formatFullName(selectedTask.reviewed_by_user.first_name, selectedTask.reviewed_by_user.last_name)}
                {selectedTask.reviewed_at && (
                  <span className="text-muted-foreground block text-xs">
                    {formatWATDateTime(selectedTask.reviewed_at)}
                  </span>
                )}
              </DetailProperty>
            )}
          </DetailProperties>
        </section>
      </DetailBody>
    </DetailSheet>
  )
}
