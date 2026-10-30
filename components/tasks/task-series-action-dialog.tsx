"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { formatFullName } from "@/lib/utils"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { patchSeries, type PausePreview, type SeriesDetail } from "@/lib/tasks/series-client"

export type SeriesActionMode = "reassign" | "pause" | "resume" | "end"

export interface SeriesAssignableEmployee {
  id: string
  first_name: string
  last_name: string
  department: string
}

const TITLES: Record<SeriesActionMode, { title: string; description: string }> = {
  reassign: {
    title: "Reassign recurring task",
    description: "Repeats from the chosen date go to the new person. Earlier ones, and their record, stay as they are.",
  },
  pause: {
    title: "Pause recurring task",
    description:
      "No repeats are created while it is paused. You'll see what happens to existing ones before confirming.",
  },
  resume: {
    title: "Resume recurring task",
    description: "Repeats start again from today. Monthly and longer ones held by the pause are created now.",
  },
  end: {
    title: "End recurring task",
    description: "No more repeats are created. Open repeats scheduled after today close as not planned.",
  },
}

/** One modal for every change a lead makes to a series. */
export function TaskSeriesActionDialog({
  mode,
  detail,
  assignableEmployees,
  onOpenChange,
  onDone,
}: {
  mode: SeriesActionMode | null
  detail: SeriesDetail
  assignableEmployees: SeriesAssignableEmployee[]
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const today = toLocalISODate()
  const [assignee, setAssignee] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [moveOpen, setMoveOpen] = useState(true)
  const [pauseFrom, setPauseFrom] = useState(today)
  const [pauseUntil, setPauseUntil] = useState("")
  const [preview, setPreview] = useState<PausePreview | null>(null)
  const [endReason, setEndReason] = useState<"completed_early" | "no_longer_needed" | "">("")
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const seriesId = detail.series.id
  const titleById = new Map(detail.tasks.map((t) => [t.id, t.occurrence_date]))
  const employeeOptions = assignableEmployees
    .filter((e) => e.id !== detail.current_assignee)
    .map((e) => ({ value: e.id, label: `${formatFullName(e.first_name, e.last_name)} (${e.department})` }))

  function reset() {
    setAssignee("")
    setEffectiveFrom(today)
    setMoveOpen(true)
    setPauseFrom(today)
    setPauseUntil("")
    setPreview(null)
    setEndReason("")
    setNote("")
  }

  function close(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  async function run(body: Record<string, unknown>, success: string) {
    setIsSaving(true)
    try {
      await patchSeries(seriesId, body)
      toast.success(success)
      reset()
      onOpenChange(false)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the recurring task")
    } finally {
      setIsSaving(false)
    }
  }

  async function loadPausePreview() {
    setIsSaving(true)
    try {
      const data = await patchSeries<{ preview: PausePreview }>(seriesId, {
        action: "pause",
        from: pauseFrom,
        until: pauseUntil || null,
        confirm: false,
      })
      setPreview(data.preview)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check the pause")
    } finally {
      setIsSaving(false)
    }
  }

  if (!mode) return null
  const copy = TITLES[mode]
  const label = (iso: string | null | undefined) => (iso ? formatWATDate(iso) : "—")

  return (
    <ResponsiveModal open={mode !== null} onOpenChange={close} title={copy.title} description={copy.description}>
      <div className="space-y-4 text-sm">
        {mode === "reassign" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New assignee *</Label>
              <SearchableSelect
                options={employeeOptions}
                value={assignee}
                onValueChange={setAssignee}
                placeholder="Select a team member..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="series-effective-from" className="text-xs font-medium">
                Starting from *
              </Label>
              <Input
                id="series-effective-from"
                type="date"
                min={today}
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={moveOpen} onCheckedChange={(value) => setMoveOpen(value === true)} />
              <span>Also hand over open repeats dated before then, such as today&apos;s one already under way.</span>
            </label>
          </>
        )}

        {mode === "pause" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="series-pause-from" className="text-xs font-medium">
                  Pause from *
                </Label>
                <Input
                  id="series-pause-from"
                  type="date"
                  min={today}
                  value={pauseFrom}
                  onChange={(e) => {
                    setPauseFrom(e.target.value)
                    setPreview(null)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="series-pause-until" className="text-xs font-medium">
                  Resume after (optional)
                </Label>
                <Input
                  id="series-pause-until"
                  type="date"
                  min={pauseFrom}
                  value={pauseUntil}
                  onChange={(e) => {
                    setPauseUntil(e.target.value)
                    setPreview(null)
                  }}
                />
                <p className="text-muted-foreground text-xs">Leave empty to pause until you resume it.</p>
              </div>
            </div>

            {preview && (
              <div className="bg-muted/30 space-y-1.5 rounded-lg border p-3 text-xs">
                <p className="font-semibold">Heads-up</p>
                {preview.skip.length === 0 && preview.move.length === 0 && preview.hold.length === 0 && (
                  <p className="text-muted-foreground">No existing repeats fall inside this pause.</p>
                )}
                {preview.skip.length > 0 && (
                  <p>
                    {preview.skip.length} repeat{preview.skip.length === 1 ? "" : "s"} (
                    {preview.skip.map((s) => label(s.due)).join(", ")}) will be skipped and closed as not planned.
                  </p>
                )}
                {preview.move.map((m) => (
                  <p key={m.id}>
                    The repeat due {label(titleById.get(m.id) ?? m.from)} will be due {label(m.to)} instead.
                  </p>
                ))}
                {preview.hold.length > 0 && (
                  <p>
                    {preview.hold.length} repeat{preview.hold.length === 1 ? "" : "s"} will wait, and get a new deadline
                    when you resume.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {mode === "end" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Why is it ending? *</Label>
              <Select value={endReason} onValueChange={(value) => setEndReason(value as typeof endReason)}>
                <SelectTrigger aria-label="End reason">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed_early">Completed early</SelectItem>
                  <SelectItem value="no_longer_needed">No longer needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[70px] text-xs" />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => close(false)} disabled={isSaving}>
            Cancel
          </Button>
          {mode === "reassign" && (
            <Button
              size="sm"
              disabled={isSaving || !assignee || !effectiveFrom}
              onClick={() =>
                void run(
                  { action: "reassign", assigned_to: assignee, effective_from: effectiveFrom, move_open: moveOpen },
                  "Recurring task reassigned"
                )
              }
            >
              {isSaving ? "Saving..." : "Reassign"}
            </Button>
          )}
          {mode === "pause" &&
            (preview ? (
              <Button
                size="sm"
                disabled={isSaving}
                onClick={() =>
                  void run(
                    { action: "pause", from: pauseFrom, until: pauseUntil || null, confirm: true },
                    "Recurring task paused"
                  )
                }
              >
                {isSaving ? "Saving..." : "Confirm pause"}
              </Button>
            ) : (
              <Button size="sm" disabled={isSaving || !pauseFrom} onClick={() => void loadPausePreview()}>
                {isSaving ? "Checking..." : "Continue"}
              </Button>
            ))}
          {mode === "resume" && (
            <Button
              size="sm"
              disabled={isSaving}
              onClick={() => void run({ action: "resume" }, "Recurring task resumed")}
            >
              {isSaving ? "Saving..." : "Resume"}
            </Button>
          )}
          {mode === "end" && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isSaving || !endReason}
              onClick={() =>
                void run({ action: "end", reason: endReason, note: note.trim() || undefined }, "Recurring task ended")
              }
            >
              {isSaving ? "Saving..." : "End series"}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveModal>
  )
}
