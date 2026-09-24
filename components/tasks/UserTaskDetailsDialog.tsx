"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, AlertTriangle, Send, Building2, CalendarDays, Target, User, Gauge, Star } from "lucide-react"
import type { Task } from "@/types/task"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TaskStatusControl } from "@/components/tasks/TaskStatusControl"
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/lib/tasks/constants"
import { formatWATDateTime, formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { isTaskOverdue } from "@/lib/tasks/overdue"
import { cn, formatFullName } from "@/lib/utils"
import { TASK_WEIGHT_DEFAULT, getTaskWeightBadgeClass } from "@/lib/tasks/scoring"
import {
  DetailActionBar,
  DetailCallout,
  DetailField,
  DetailFieldGrid,
  DetailSectionHeading,
  DetailTimelineEntry,
} from "@/components/ui/detail-dialog"

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        `max-h`, not a fixed `h`: a task with no description and no comments gets
        a short dialog instead of a near-full screen of empty space.
      */}
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* ── Header: identity, and each fact exactly once ─────────────────── */}
        <DialogHeader className="space-y-2 border-b px-4 py-4 text-left sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedTask.work_item_number && (
              <Badge variant="outline" className="font-mono text-[11px]">
                {selectedTask.work_item_number}
              </Badge>
            )}
            {(() => {
              const cfg = TASK_STATUS_CONFIG[selectedTask.status as TaskStatus] || TASK_STATUS_CONFIG.pending
              return (
                <Badge variant={cfg.badgeVariant} className={cn("text-[11px] capitalize", cfg.color)}>
                  {cfg.label}
                </Badge>
              )
            })()}
            <Badge
              variant="outline"
              className={cn("font-mono text-[11px] font-medium", getTaskWeightBadgeClass(selectedTask.weight))}
            >
              Weight {selectedTask.weight ?? TASK_WEIGHT_DEFAULT}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" className="gap-1 text-[11px]">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </Badge>
            )}
          </div>

          <DialogTitle className="text-base leading-snug font-semibold">{selectedTask.title}</DialogTitle>

          <DialogDescription className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span>Assigned by {assignedByName}</span>
            {selectedTask.department && (
              <>
                <span aria-hidden>·</span>
                <span>{selectedTask.department}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className={isOverdue ? "text-destructive font-medium" : undefined}>Due {dueLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {/* ── The action, pinned directly under the header ─────────────────── */}
        {/* Moving a task forward is why this dialog gets opened, so it sits above
            the scroll rather than inside a tab you have to find. */}
        <DetailActionBar label="Move this task to">
          <TaskStatusControl
            task={selectedTask}
            canReview={canReview}
            ratingBlockedReason={ratingBlockedReason}
            onChanged={() => onChanged?.()}
          />
        </DetailActionBar>

        <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-4 py-2 sm:px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5">
                <span>Activity</span>
                {taskUpdates.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                    {taskUpdates.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-5 px-4 py-4 sm:px-6">
              {/* Anything that needs answering comes before the reference data. */}
              {(selectedTask.unable_to_complete_reason ||
                selectedTask.failure_reason ||
                selectedTask.extension_reason) && (
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
                <section className="space-y-1.5">
                  <DetailSectionHeading>What was asked for</DetailSectionHeading>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                </section>
              )}

              <section className="space-y-3">
                <DetailSectionHeading>Details</DetailSectionHeading>
                <DetailFieldGrid>
                  <DetailField icon={User} label="Assigned to">
                    {assignedToName}
                  </DetailField>
                  <DetailField icon={CalendarDays} label="Period">
                    {startLabel || "—"} to {endSource ? formatWATDate(endSource) : "no deadline"}
                  </DetailField>
                  <DetailField icon={Target} label="Strategic goal">
                    {selectedTask.goal_title || <span className="text-muted-foreground">—</span>}
                  </DetailField>
                  <DetailField icon={Target} label="Corporate KPI">
                    {selectedTask.kpi_measure ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{selectedTask.kpi_measure}</span>
                        {selectedTask.kpi_pillar && (
                          <span className="text-muted-foreground text-[11px]">🎯 {selectedTask.kpi_pillar}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </DetailField>
                  <DetailField icon={Gauge} label="Weight">
                    <Badge
                      variant="outline"
                      className={cn("font-mono text-xs font-medium", getTaskWeightBadgeClass(selectedTask.weight))}
                    >
                      {selectedTask.weight ?? TASK_WEIGHT_DEFAULT}
                    </Badge>
                  </DetailField>
                  <DetailField icon={Star} label="Rating">
                    {selectedTask.rating ? (
                      `${selectedTask.rating}/5`
                    ) : (
                      <span className="text-muted-foreground">Not yet rated</span>
                    )}
                  </DetailField>
                  <DetailField icon={Building2} label="Created">
                    {formatWATDateTime(selectedTask.created_at)}
                  </DetailField>
                  {selectedTask.reviewed_by_user && (
                    <DetailField icon={User} label="Reviewed by">
                      {formatFullName(
                        selectedTask.reviewed_by_user.first_name,
                        selectedTask.reviewed_by_user.last_name
                      )}
                      {selectedTask.reviewed_at && (
                        <span className="text-muted-foreground"> · {formatWATDateTime(selectedTask.reviewed_at)}</span>
                      )}
                    </DetailField>
                  )}
                </DetailFieldGrid>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 px-4 py-4 sm:px-6">
              {onAddComment && (
                <div className="space-y-2">
                  <Textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Post an activity note or progress update…"
                    className="min-h-[72px] text-sm"
                    aria-label="Add an activity"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={isPostingComment || !commentDraft.trim()}
                      onClick={async () => {
                        await onAddComment(commentDraft.trim())
                        setCommentDraft("")
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isPostingComment ? "Posting…" : "Post activity"}
                    </Button>
                  </div>
                </div>
              )}

              {taskUpdates.length > 0 ? (
                <ul className="space-y-3">
                  {taskUpdates.map((update) => (
                    <DetailTimelineEntry
                      key={update.id}
                      title={update.user ? formatFullName(update.user.first_name, update.user.last_name) : "System"}
                      timestamp={formatWATDateTime(update.created_at)}
                    >
                      {update.content}
                    </DetailTimelineEntry>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  No activities yet.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
