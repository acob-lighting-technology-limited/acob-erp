"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { Label } from "@/components/ui/label"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { Textarea } from "@/components/ui/textarea"
import { AppealAuditTrail } from "@/components/hr/appeal-audit-trail"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/hr/attendance-status"
import type { UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { apiFetch } from "@/lib/api-client"
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"

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
  created_by?: string | null
  created_by_name?: string | null
  lead_reviewed_by?: string | null
  lead_reviewer_name?: string | null
  department_lead_name?: string | null
  lead_reviewed_at?: string | null
  lead_resolution_note?: string | null
  admin_reviewed_by?: string | null
  admin_reviewer_name?: string | null
  admin_hr_lead_name?: string | null
  admin_reviewed_at?: string | null
  admin_resolution_note?: string | null
  reviewed_by?: string | null
  reviewer_name?: string | null
  reviewed_at?: string | null
  batch_id?: string | null
  overridden_by_name?: string | null
  overridden_at?: string | null
  override_reason?: string | null
  overridden_stage?: string | null
  /** Why the viewer may not approve or reject this pending appeal; null when they may. */
  review_block?: string | null
  /** Whether the viewer may override this pending appeal. */
  can_override?: boolean
  /** Every day of a range staged as one batch, oldest first. Absent for a single day. */
  days?: AppealRow[]
  /** Last day of a batched range. */
  appeal_date_end?: string
  created_at: string
}

/** "29 Oct 2026", or "26 Oct – 29 Oct 2026 · 4 days" for a batched range. */
export function appealDateLabel(appeal: AppealRow): string {
  const format = (date: string) => formatWATDate(date, { day: "2-digit", month: "short", year: "numeric" })
  if (!appeal.days || appeal.days.length < 2 || !appeal.appeal_date_end) return format(appeal.appeal_date)
  const start = formatWATDate(appeal.appeal_date, { day: "2-digit", month: "short" })
  return `${start} – ${format(appeal.appeal_date_end)} · ${appeal.days.length} days`
}

interface AppealReviewDialogProps {
  appeal: AppealRow | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AppealReviewDialog({ appeal, open, onClose, onSuccess }: AppealReviewDialogProps) {
  const [note, setNote] = useState("")
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | "override" | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)

  // Clear the note when a different appeal is shown — adjusted during render, not in an effect.
  const [notedAppeal, setNotedAppeal] = useState(appeal)
  if (notedAppeal !== appeal) {
    setNotedAppeal(appeal)
    setNote("")
  }

  const currentNote = appeal ? note : ""
  const isLoading = loadingAction !== null
  const pendingIds = appeal ? (appeal.days ?? [appeal]).filter((d) => d.status === "pending").map((d) => d.id) : []

  async function decide(action: "approve" | "reject" | "override", noteValue: string) {
    if (!appeal) return
    setLoadingAction(action)
    try {
      const res = await apiFetch("/api/admin/hr/attendance/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds, action, resolution_note: noteValue || null }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? `Failed to ${action} appeal`)

      toast.success(
        action === "reject"
          ? "Appeal rejected"
          : action === "override"
            ? "Approved by override"
            : payload?.isFinalApproval
              ? "Appeal approved"
              : "Endorsed and sent to an admin"
      )
      setOverrideOpen(false)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} appeal`)
    } finally {
      setLoadingAction(null)
    }
  }

  function handleAction(action: "approve" | "reject") {
    const noteValue = currentNote.trim()
    if (action === "reject" && !noteValue) {
      toast.error("A resolution note is required when rejecting an appeal")
      return
    }
    void decide(action, noteValue)
  }

  const approveButtonText = () => {
    if (loadingAction === "approve") return "Processing…"
    if (appeal?.stage === "pending_lead") {
      return appeal.initiated_by_role === "admin_manual" ? "Confirm Change" : "Endorse (Send to Admin)"
    }
    return "Approve"
  }

  const isPending = appeal?.status === "pending"
  const canDecide = isPending && !appeal?.review_block
  const dayCount = pendingIds.length

  return (
    <DetailSheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
      title={isPending ? "Review Appeal" : "Appeal Details"}
      description={appeal ? `${appeal.user_name} — ${appealDateLabel(appeal)}` : "No appeal selected"}
      badges={
        appeal && appeal.status !== "pending" ? (
          <Badge
            className={
              appeal.overridden_at
                ? "bg-warning/15 text-warning"
                : appeal.status === "approved"
                  ? "bg-success/15 text-success"
                  : appeal.status === "rejected"
                    ? "bg-danger/15 text-danger"
                    : "bg-info/15 text-info"
            }
          >
            {appeal.overridden_at ? "OVERRIDDEN" : appeal.status.toUpperCase()}
          </Badge>
        ) : null
      }
      footer={
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {isPending ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              {appeal?.can_override && (
                <Button variant="outline" onClick={() => setOverrideOpen(true)} disabled={isLoading}>
                  Override
                </Button>
              )}
              {canDecide && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction("reject")}
                    disabled={isLoading || !currentNote.trim()}
                  >
                    {loadingAction === "reject" ? "Rejecting…" : "Reject"}
                  </Button>
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => handleAction("approve")}
                    disabled={isLoading}
                  >
                    {approveButtonText()}
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      }
    >
      {appeal && (
        <div className="space-y-4">
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
              <span className="text-muted-foreground">{appeal.days && appeal.days.length > 1 ? "Days" : "Day"}</span>
              <span className="font-medium">{appealDateLabel(appeal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span className="text-muted-foreground text-xs">{formatWATDateTime(appeal.created_at)}</span>
            </div>
          </div>

          {/* Status change preview */}
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Status Change</p>
            <div className="flex items-center gap-2 text-sm">
              <Badge
                className={
                  ATTENDANCE_STATUS_COLORS[appeal.current_status as UnifiedAttendanceStatus] ??
                  "bg-muted text-muted-foreground"
                }
              >
                {ATTENDANCE_STATUS_LABELS[appeal.current_status as UnifiedAttendanceStatus] ?? appeal.current_status}
              </Badge>
              <span className="text-muted-foreground font-medium">→</span>
              <Badge
                className={
                  ATTENDANCE_STATUS_COLORS[appeal.requested_status as UnifiedAttendanceStatus] ?? "bg-info/15 text-info"
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
            <p className="text-sm leading-relaxed">{appeal.appeal_reason || "No reason specified"}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Audit History</p>
            <AppealAuditTrail appeal={appeal} />
          </div>

          {isPending && appeal.review_block && (
            <div className="text-muted-foreground bg-muted/40 rounded-lg border p-2.5 text-xs">
              {appeal.review_block}
            </div>
          )}

          {canDecide && (
            <div className="space-y-2">
              <Label htmlFor="resolution-note">
                Decision Note <span className="text-muted-foreground text-xs">(required for rejection)</span>
              </Label>
              <Textarea
                id="resolution-note"
                placeholder="Add a note explaining your decision…"
                value={currentNote}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                disabled={isLoading}
                className="resize-none"
              />
            </div>
          )}
        </div>
      )}

      <PromptDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        title="Override this approval?"
        description={`Only override if the person who should approve this (usually the Department Lead) is not available. This approves ${dayCount > 1 ? `all ${dayCount} days` : "it"} now, skips the remaining steps, and is recorded against your name. The employee, the skipped approver and the Admin & HR Lead are told.`}
        label="Reason for overriding"
        placeholder="e.g. Department Lead on leave, payroll closes today"
        inputType="textarea"
        required
        confirmLabel="Override and approve"
        confirmLoadingLabel="Overriding…"
        onConfirm={(reason) => decide("override", reason.trim())}
      />
    </DetailSheet>
  )
}
