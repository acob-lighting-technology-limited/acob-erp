"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/hr/attendance-status"
import type { UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { apiFetch } from "@/lib/api-client"
import { formatWATDateTime } from "@/lib/utils/date"

export interface AppealRow {
  id: string
  user_id: string
  user_name: string
  department: string
  appeal_date: string
  current_status: string
  /** The day's status now; current_status is a snapshot from when the appeal was raised. */
  live_status?: string
  requested_status: string
  appeal_reason: string
  resolution_note: string | null
  status: "pending" | "approved" | "rejected" | "resolved"
  stage?: "pending_lead" | "pending_admin" | "pending_hr_lead" | "approved" | "rejected" | "resolved"
  initiated_by_role?: "employee" | "lead_on_behalf" | "admin_manual"
  lead_reviewed_by?: string | null
  lead_reviewed_at?: string | null
  lead_resolution_note?: string | null
  admin_reviewed_by?: string | null
  admin_reviewed_at?: string | null
  admin_resolution_note?: string | null
  created_at: string
}

interface AppealReviewDialogProps {
  appeal: AppealRow | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AppealReviewDialog({ appeal, open, onClose, onSuccess }: AppealReviewDialogProps) {
  const [note, setNote] = useState("")
  const [approvingLoad, setApprovingLoad] = useState(false)
  const [rejectingLoad, setRejectingLoad] = useState(false)

  // Clear the note when a different appeal is shown — adjusted during render, not in an effect.
  const [notedAppeal, setNotedAppeal] = useState(appeal)
  if (notedAppeal !== appeal) {
    setNotedAppeal(appeal)
    setNote("")
  }

  const currentNote = appeal ? note : ""
  const isLoading = approvingLoad || rejectingLoad

  async function handleAction(action: "approve" | "reject") {
    if (!appeal) return
    const noteValue = currentNote.trim()
    if (action === "reject" && !noteValue) {
      toast.error("A resolution note is required when rejecting an appeal")
      return
    }

    const setter = action === "approve" ? setApprovingLoad : setRejectingLoad
    setter(true)
    try {
      const res = await apiFetch("/api/admin/hr/attendance/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appeal.id,
          action,
          resolution_note: noteValue || null,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? `Failed to ${action} appeal`)

      const successMsg =
        action === "reject"
          ? "Appeal rejected"
          : payload?.isFinalApproval
            ? "Appeal approved"
            : "Appeal endorsed and advanced to next stage"
      toast.success(successMsg)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} appeal`)
    } finally {
      setter(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose()
  }

  function handleNoteChange(value: string) {
    setNote(value)
  }

  const displayNote = appeal ? note : ""

  const approveButtonText = () => {
    if (approvingLoad) return "Processing…"
    if (appeal?.stage === "pending_lead") {
      return appeal.initiated_by_role === "admin_manual" ? "Confirm Alteration" : "Endorse (Advance to HR)"
    }
    if (appeal?.stage === "pending_hr_lead") {
      return "Final Approve (HR Lead)"
    }
    return "Approve"
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review Appeal</DialogTitle>
          <DialogDescription>
            {appeal ? `${appeal.user_name} — ${appeal.appeal_date}` : "No appeal selected"}
          </DialogDescription>
        </DialogHeader>

        {appeal && (
          <div className="space-y-4 py-2">
            {/* Employee & date summary */}
            <div className="bg-muted/50 space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employee</span>
                <div className="text-right">
                  <div className="font-medium">{appeal.user_name}</div>
                  <div className="text-muted-foreground text-xs">{appeal.department}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{appeal.appeal_date}</span>
              </div>
              {appeal.initiated_by_role === "admin_manual" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Origin</span>
                  <Badge variant="outline" className="border-blue-200 text-blue-600">
                    Admin Manual Alteration
                  </Badge>
                </div>
              )}
              {appeal.initiated_by_role === "lead_on_behalf" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Origin</span>
                  <Badge variant="outline" className="border-purple-200 text-purple-600">
                    Lead on Behalf
                  </Badge>
                </div>
              )}
            </div>

            {/* Status change preview */}
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Status Change</p>
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  className={
                    ATTENDANCE_STATUS_COLORS[appeal.current_status as UnifiedAttendanceStatus] ??
                    "bg-gray-100 text-gray-800"
                  }
                >
                  {ATTENDANCE_STATUS_LABELS[appeal.current_status as UnifiedAttendanceStatus] ?? appeal.current_status}
                </Badge>
                <span className="text-muted-foreground font-medium">→</span>
                <Badge
                  className={
                    ATTENDANCE_STATUS_COLORS[appeal.requested_status as UnifiedAttendanceStatus] ??
                    "bg-blue-100 text-blue-800"
                  }
                >
                  {ATTENDANCE_STATUS_LABELS[appeal.requested_status as UnifiedAttendanceStatus] ??
                    appeal.requested_status}
                </Badge>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {appeal.initiated_by_role === "admin_manual" ? "Admin's Reason" : "Employee's Reason"}
              </p>
              <p className="text-sm leading-relaxed">{appeal.appeal_reason}</p>
            </div>

            {/* Previous endorsement note if in later stages */}
            {appeal.lead_resolution_note && appeal.stage !== "pending_lead" && (
              <div className="bg-muted/40 space-y-1 rounded border p-2.5 text-xs">
                <div className="text-foreground flex items-center justify-between font-medium">
                  <span>Lead Endorsement</span>
                  {appeal.lead_reviewed_at && (
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {formatWATDateTime(appeal.lead_reviewed_at)}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground italic">&ldquo;{appeal.lead_resolution_note}&rdquo;</p>
              </div>
            )}

            {/* Resolution note */}
            <div className="space-y-2">
              <Label htmlFor="resolution-note">
                Decision Note <span className="text-muted-foreground text-xs">(required for rejection)</span>
              </Label>
              <Textarea
                id="resolution-note"
                placeholder="Add a note explaining your decision…"
                value={displayNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                rows={3}
                disabled={isLoading}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleAction("reject")}
            disabled={isLoading || !appeal || !currentNote.trim()}
          >
            {rejectingLoad ? "Rejecting…" : "Reject"}
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void handleAction("approve")}
            disabled={isLoading || !appeal}
          >
            {approveButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
