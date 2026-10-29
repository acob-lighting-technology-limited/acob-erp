"use client"

import type { Dispatch, SetStateAction } from "react"
import type { AttendanceReport, TimelineContext, TimelineEvent } from "../view"
import { formatDayShort, EVENT_LABELS, eventBadgeClass } from "../view"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"
import { ATTENDANCE_STATUS_LABELS } from "@/lib/hr/attendance-status"

interface DayTimelineDialogProps {
  historyOpen: boolean
  setHistoryOpen: Dispatch<SetStateAction<boolean>>
  historyTarget: { date: string } | null
  report: AttendanceReport
  historyContext: TimelineContext | null
  historyLoading: boolean
  historyItems: TimelineEvent[]
}

export function DayTimelineDialog({
  historyOpen,
  setHistoryOpen,
  historyTarget,
  report,
  historyContext,
  historyLoading,
  historyItems,
}: DayTimelineDialogProps) {
  return (
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Day Timeline</DialogTitle>
          <DialogDescription>
            {historyTarget ? `${report.user_name} — ${formatDayShort(historyTarget.date)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {historyContext && (historyContext.holiday || historyContext.on_leave || historyContext.exempt) && (
          <div className="flex flex-wrap gap-2">
            {historyContext.holiday && (
              <Badge className="bg-info/15 text-info text-xs">
                Holiday — {historyContext.holiday}
                {historyContext.holiday_added_by ? ` · added by ${historyContext.holiday_added_by}` : ""}
              </Badge>
            )}
            {historyContext.on_leave && (
              <Badge className="bg-purple/15 text-purple text-xs">On leave — {historyContext.on_leave}</Badge>
            )}
            {historyContext.exempt && (
              <Badge className="bg-purple/15 text-purple text-xs">
                Exempt{historyContext.exempt_reason ? ` — ${historyContext.exempt_reason}` : ""}
              </Badge>
            )}
          </div>
        )}

        <div className="max-h-[420px] space-y-3 overflow-y-auto">
          {historyLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : historyItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recorded events for this day.</p>
          ) : (
            historyItems.map((item) => {
              const label = EVENT_LABELS[item.event_type] ?? item.event_type.replaceAll("_", " ")
              const fromLabel = item.from_status
                ? (ATTENDANCE_STATUS_LABELS[item.from_status as keyof typeof ATTENDANCE_STATUS_LABELS] ??
                  item.from_status)
                : null
              const toLabel = item.to_status
                ? (ATTENDANCE_STATUS_LABELS[item.to_status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? item.to_status)
                : null
              const isAutomated = item.actor_name === null
              return (
                <div key={item.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`text-xs ${eventBadgeClass(item.event_type)}`}>{label}</Badge>
                    <p className="text-sm font-medium">{isAutomated ? "System / Device" : item.actor_name}</p>
                  </div>
                  <p className="text-muted-foreground text-xs">{formatWATDateTime(item.created_at)}</p>
                  {(fromLabel || toLabel) && (
                    <p className="mt-1 text-xs">
                      <span className="font-medium">Status:</span>{" "}
                      <span className="text-muted-foreground">
                        {fromLabel ? `${fromLabel} → ` : ""}
                        {toLabel ?? "—"}
                      </span>
                    </p>
                  )}
                  {item.comment && (
                    <p className="mt-1 text-xs">
                      <span className="font-medium">Comment:</span>{" "}
                      <span className="text-muted-foreground">{item.comment}</span>
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
