"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Pause, Play, Repeat, StopCircle, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusControl"
import {
  TaskSeriesActionDialog,
  type SeriesActionMode,
  type SeriesAssignableEmployee,
} from "@/components/tasks/task-series-action-dialog"
import { apiFetch } from "@/lib/api-client"
import { formatFullName } from "@/lib/utils"
import { formatWATDate } from "@/lib/utils/date"
import { TASK_RATING_MAX, TASK_RATING_MIN } from "@/lib/tasks/scoring"
import { fetchSeriesDetail, seriesDetailKey, seriesListKey } from "@/lib/tasks/series-client"

const STATUS_LABELS = { active: "Active", paused: "Paused", ended: "Ended" } as const

/**
 * A recurring task's record: its schedule, who held it when, what is coming
 * up, and every repeat so far. Leads manage it from the footer; submitted
 * repeats can be approved together with one rating.
 */
export function TaskSeriesSheet({
  seriesId,
  onOpenChange,
  assignableEmployees = [],
  onChanged,
  readOnly = false,
}: {
  seriesId: string | null
  onOpenChange: (open: boolean) => void
  assignableEmployees?: SeriesAssignableEmployee[]
  /** Called after any change, so the page's task list can reload. */
  onChanged?: () => void
  /**
   * The staff /tasks page: show the series, never manage it. Reassign, pause,
   * end and bulk approval belong to the admin and department task pages, even
   * for a lead who happens to open their own copy here.
   */
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const [action, setAction] = useState<SeriesActionMode | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRating, setBulkRating] = useState<number | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  const { data: detail, isLoading } = useQuery({
    queryKey: seriesDetailKey(seriesId ?? ""),
    queryFn: () => fetchSeriesDetail(seriesId as string),
    enabled: Boolean(seriesId),
  })

  const nameById = useMemo(
    () =>
      new Map(
        (detail?.people ?? []).map((p) => [p.id, formatFullName(p.first_name ?? "", p.last_name ?? "") || "Unknown"])
      ),
    [detail?.people]
  )
  const submitted = useMemo(
    () => (detail?.tasks ?? []).filter((t) => t.status === "submitted_for_review"),
    [detail?.tasks]
  )

  function refresh() {
    setSelected(new Set())
    setBulkRating(null)
    void queryClient.invalidateQueries({ queryKey: seriesDetailKey(seriesId ?? "") })
    void queryClient.invalidateQueries({ queryKey: seriesListKey })
    onChanged?.()
  }

  function toggle(taskId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(taskId)
      else next.delete(taskId)
      return next
    })
  }

  /**
   * Approves each selected repeat through the normal status route, so every
   * rule a single approval enforces - reviewer rights, self-rating - still applies.
   */
  async function approveSelected() {
    if (!bulkRating || selected.size === 0) return
    setIsApproving(true)
    let approved = 0
    const failures: string[] = []
    for (const taskId of selected) {
      const res = await apiFetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          rating: bulkRating,
          comment: "Approved with its recurring series",
        }),
      })
      if (res.ok) approved += 1
      else {
        const body = await res.json().catch(() => null)
        failures.push(body?.error || "Failed")
      }
    }
    setIsApproving(false)
    if (approved > 0) toast.success(`${approved} repeat${approved === 1 ? "" : "s"} approved and rated ${bulkRating}`)
    if (failures.length > 0) toast.error(`${failures.length} could not be approved: ${failures[0]}`)
    refresh()
  }

  const series = detail?.series
  const canManage = !readOnly && Boolean(detail?.can_manage) && series?.status !== "ended"

  return (
    <>
      <DetailSheet
        open={seriesId !== null}
        onOpenChange={onOpenChange}
        title={series?.title ?? "Recurring task"}
        leading={<Repeat className="text-primary h-5 w-5 shrink-0" />}
        description={detail ? detail.schedule_label : undefined}
        badges={
          series ? (
            <Badge variant={series.status === "active" ? "default" : "outline"} className="text-xs">
              {STATUS_LABELS[series.status]}
            </Badge>
          ) : null
        }
        footer={
          canManage && series ? (
            <>
              <div className="flex gap-2">
                {assignableEmployees.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setAction("reassign")}>
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                    Reassign
                  </Button>
                )}
                {series.status === "paused" ? (
                  <Button variant="outline" size="sm" onClick={() => setAction("resume")}>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Resume
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setAction("pause")}>
                    <Pause className="mr-1.5 h-3.5 w-3.5" />
                    Pause
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setAction("end")}>
                <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                End series
              </Button>
            </>
          ) : undefined
        }
      >
        {isLoading || !detail || !series ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading recurring task...
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <SectionHeading title="Schedule" />
              <DetailList
                items={[
                  { label: "Repeats", value: detail.schedule_label },
                  { label: "Starts", value: formatWATDate(series.start_date) },
                  { label: "Ends", value: series.end_date ? formatWATDate(series.end_date) : "Never" },
                  {
                    label: "Assigned to",
                    value: detail.current_assignee ? nameById.get(detail.current_assignee) : null,
                  },
                  { label: "Weight", value: series.weight },
                  { label: "Department", value: series.department },
                  ...(series.status === "paused" && series.paused_from
                    ? [
                        {
                          label: "Paused",
                          value: series.paused_until
                            ? `${formatWATDate(series.paused_from)} – ${formatWATDate(series.paused_until)}`
                            : `From ${formatWATDate(series.paused_from)}, until resumed`,
                          wide: true,
                        },
                      ]
                    : []),
                  ...(series.description ? [{ label: "Description", value: series.description, wide: true }] : []),
                ]}
              />
            </section>

            {detail.upcoming.length > 0 && (
              <section className="space-y-2">
                <SectionHeading title="Next due" />
                <div className="flex flex-wrap gap-1.5">
                  {detail.upcoming.map((date) => (
                    <Badge key={date} variant="outline" className="text-xs font-normal">
                      {formatWATDate(date)}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Each repeat is created ahead of its due date, as an ordinary task in the assignee&apos;s list.
                </p>
              </section>
            )}

            {detail.assignees.length > 1 && (
              <section className="space-y-2">
                <SectionHeading title="Who held it" />
                <ul className="space-y-1 text-xs">
                  {detail.assignees.map((a) => (
                    <li key={a.effective_from} className="flex justify-between gap-3">
                      <span className="font-medium">{nameById.get(a.assigned_to) ?? "Unknown"}</span>
                      <span className="text-muted-foreground">from {formatWATDate(a.effective_from)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              <SectionHeading
                title={`Repeats (${detail.tasks.length})`}
                aside={
                  canManage && submitted.length > 0 ? (
                    <button
                      type="button"
                      className="text-primary text-xs font-medium"
                      onClick={() =>
                        setSelected(
                          selected.size === submitted.length ? new Set() : new Set(submitted.map((t) => t.id))
                        )
                      }
                    >
                      {selected.size === submitted.length ? "Clear selection" : `Select ${submitted.length} submitted`}
                    </button>
                  ) : undefined
                }
              />

              {canManage && selected.size > 0 && (
                <div className="bg-muted/30 space-y-2 rounded-lg border p-3">
                  <p className="text-xs font-medium">
                    Approve {selected.size} repeat{selected.size === 1 ? "" : "s"} with one rating
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: TASK_RATING_MAX - TASK_RATING_MIN + 1 }, (_, i) => TASK_RATING_MIN + i).map(
                      (value) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={bulkRating === value ? "default" : "outline"}
                          className="h-9"
                          onClick={() => setBulkRating(value)}
                        >
                          {value}
                        </Button>
                      )
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!bulkRating || isApproving}
                    onClick={() => void approveSelected()}
                  >
                    {isApproving ? "Approving..." : "Approve and rate"}
                  </Button>
                </div>
              )}

              {detail.tasks.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No repeats yet. The first one is created
                  {detail.upcoming[0] ? ` ahead of ${formatWATDate(detail.upcoming[0])}` : " ahead of its due date"}.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {detail.tasks.map((task) => {
                    const selectable = canManage && task.status === "submitted_for_review"
                    return (
                      <li key={task.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                        {canManage && (
                          <Checkbox
                            aria-label={`Select repeat due ${task.occurrence_date}`}
                            disabled={!selectable}
                            checked={selected.has(task.id)}
                            onCheckedChange={(value) => toggle(task.id, value === true)}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {formatWATDate(task.task_end_date || task.due_date || task.occurrence_date || "")}
                          </p>
                          <p className="text-muted-foreground truncate">
                            {task.assigned_to ? nameById.get(task.assigned_to) : "Unassigned"}
                            {task.work_item_number ? ` · ${task.work_item_number}` : ""}
                          </p>
                        </div>
                        {task.rating != null && <span className="text-muted-foreground">Rated {task.rating}/5</span>}
                        <TaskStatusBadge status={task.status} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </DetailSheet>

      {detail && (
        <TaskSeriesActionDialog
          mode={action}
          detail={detail}
          assignableEmployees={assignableEmployees}
          onOpenChange={(open) => !open && setAction(null)}
          onDone={refresh}
        />
      )}
    </>
  )
}
