"use client"

import { useState, useCallback } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import {
  Clock,
  User,
  FileCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  Check,
  X,
  Layers,
  ExternalLink,
  ShieldCheck,
  MessageSquare,
  Paperclip,
  CalendarDays,
} from "lucide-react"
import { LeaveItem, approvalStageKey, resolvePersonName, getStageBadge, resolveLeaveRouteStages } from "../view"
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"
import { leaveEvidenceHref, leaveHandoverHref } from "@/lib/hr/leave-attachment-links"
import { formatName, cn } from "@/lib/utils"

interface LeaveDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leave: LeaveItem | null
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  showActionButtons?: boolean
}

function safeDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    return formatWATDate(dateStr)
  } catch {
    return dateStr
  }
}

function getInitials(name?: string | null): string {
  if (!name) return "LR"
  const clean = name.trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase()
}

export function LeaveDetailDialog({
  open,
  onOpenChange,
  leave,
  onApprove,
  onReject,
  showActionButtons = false,
}: LeaveDetailDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const staffAvatars = useStaffAvatars()

  const handleCopy = useCallback((text: string, fieldName: string) => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  if (!leave) return null

  const timeline = [...(leave.approvals || [])].sort((left, right) => {
    const leftOrder = Number(left.stage_order || left.approval_level || 999)
    const rightOrder = Number(right.stage_order || right.approval_level || 999)
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return String(left.approved_at || "").localeCompare(String(right.approved_at || ""))
  })

  const stageAuditMap = new Map<string, (typeof timeline)[number]>()
  for (const item of timeline) {
    const key = approvalStageKey(item.stage_code)
    const existing = stageAuditMap.get(key)
    if (!existing) {
      stageAuditMap.set(key, item)
      continue
    }

    const existingTime = existing.approved_at ? new Date(existing.approved_at).getTime() : 0
    const nextTime = item.approved_at ? new Date(item.approved_at).getTime() : 0
    if (nextTime >= existingTime) {
      stageAuditMap.set(key, item)
    }
  }

  const stageOrder = resolveLeaveRouteStages(leave)
  const stageName: Record<string, string> = {
    reliever: "Reliever Review",
    department_lead: "Department Lead",
    admin_hr_lead: "Admin and HR Lead",
    hcs: "Head, Corporate Services",
    md: "Managing Director",
  }
  const currentStageKey = approvalStageKey(leave.current_stage_code || leave.approval_stage)
  const hasRelieverAssignee = Boolean(leave.reliever?.id || leave.reliever_id)
  const relieverHandledByLead =
    Boolean(leave.reliever?.id || leave.reliever_id) &&
    Boolean(leave.supervisor?.id || leave.supervisor_id) &&
    (leave.reliever?.id || leave.reliever_id) === (leave.supervisor?.id || leave.supervisor_id) &&
    Boolean(stageAuditMap.get("department_lead"))
  const departmentLeadApproverName = resolvePersonName(stageAuditMap.get("department_lead")?.approver)
  const advancedPastReliever = ["department_lead", "admin_hr_lead", "hcs", "md"].includes(currentStageKey)

  const statusLower = String(leave.status || "").toLowerCase()
  const isApproved = statusLower === "approved" || statusLower === "completed"
  const isRejected = statusLower === "rejected"
  const isCancelled = statusLower === "cancelled"

  const employeeName = leave.user?.full_name || "Employee"
  const employeeEmail = leave.user?.company_email || ""
  const employeeDept = leave.user?.department || "Unassigned"
  const leaveTypeName = leave.leave_type?.name || "—"

  // Check if any rejection comments exist in the timeline or on the leave object
  const rejectionStageItem = timeline.find((item) => String(item.status || "").toLowerCase() === "rejected")
  const rejectionReason = leave.rejected_reason || rejectionStageItem?.comments || null

  const hasHandover = Boolean(leave.handover_checklist_url || leave.handover_note)
  const hasEvidence = Boolean(leave.evidence && leave.evidence.length > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        {/* Sheet Header */}
        <SheetHeader className="bg-muted/20 border-b px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <StaffAvatar
                name={employeeName}
                src={staffAvatars[leave.user_id]}
                profileId={leave.user_id}
                initials={getInitials(employeeName)}
                className="h-11 w-11 border text-xs shadow-xs"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate text-base font-semibold">{formatName(employeeName)}</SheetTitle>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50/50 font-mono text-[11px] font-medium text-blue-600 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                  >
                    {leaveTypeName}
                  </Badge>
                </div>
                <SheetDescription className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span>{employeeDept}</span>
                  <span>•</span>
                  <span>
                    {safeDateDisplay(leave.start_date)} – {safeDateDisplay(leave.end_date)} ({leave.days_count}{" "}
                    {leave.days_count === 1 ? "day" : "days"})
                  </span>
                </SheetDescription>
              </div>
            </div>

            {/* Quick Status Badges in Header */}
            <div className="flex shrink-0 items-center gap-2">
              {getStageBadge(leave)}
              <Badge
                className={cn(
                  "px-2.5 py-0.5 text-xs font-medium capitalize",
                  isApproved
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                    : isRejected || isCancelled
                      ? "border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                )}
                variant="outline"
              >
                {leave.status}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Content Body — Unified Single View */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-6">
            {/* Status Callout Banner */}
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3.5 text-xs shadow-xs",
                isApproved
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : isRejected
                    ? "border-red-200 bg-red-50/60 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                    : isCancelled
                      ? "border-muted bg-muted/40 text-muted-foreground"
                      : "border-amber-200 bg-amber-50/50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
              )}
            >
              {isApproved ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : isRejected ? (
                <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              ) : isCancelled ? (
                <AlertCircle className="text-muted-foreground h-5 w-5 shrink-0" />
              ) : (
                <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {isApproved
                    ? "Leave Request Approved"
                    : isRejected
                      ? "Leave Request Rejected"
                      : isCancelled
                        ? "Leave Request Cancelled"
                        : `Currently in Progress: Awaiting ${currentStageKey.replace(/_/g, " ").toUpperCase()}`}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                  {isApproved
                    ? "All required endorsements have been completed. The employee is scheduled for leave."
                    : isRejected
                      ? "This application was rejected during the approval workflow and will not proceed."
                      : isCancelled
                        ? "This application was cancelled by the requester or administrator."
                        : "This leave request is progressing through the organizational endorsement hierarchy."}
                </p>
                {isRejected && rejectionReason && (
                  <div className="mt-2.5 rounded-md border border-red-300/80 bg-red-100/70 p-2.5 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200">
                    <span className="mb-0.5 block font-semibold">Rejection Reason:</span>
                    <span>&ldquo;{rejectionReason}&rdquo;</span>
                  </div>
                )}
              </div>
            </div>

            {/* Concurrent Department Leave Notice */}
            {leave.department_overlaps && leave.department_overlaps.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-amber-300/80 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Concurrent Department Leave Notice</span>
                </div>
                <p className="text-muted-foreground leading-relaxed dark:text-amber-300/80">
                  The following colleague(s) in this department also have scheduled or pending leave during these dates:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {leave.department_overlaps.map((overlap) => (
                    <Badge
                      key={overlap.id}
                      variant="outline"
                      className="border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      {overlap.full_name} ({safeDateDisplay(overlap.start_date)} to {safeDateDisplay(overlap.end_date)})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: Leave Details & Application Reason */}
            <div className="bg-card space-y-3 rounded-lg border p-4 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <CalendarDays className="text-primary h-3.5 w-3.5" /> Leave Details & Application
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Start Date</span>
                  <span className="text-foreground font-medium">{safeDateDisplay(leave.start_date)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">End Date</span>
                  <span className="text-foreground font-medium">{safeDateDisplay(leave.end_date)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Duration</span>
                  <span className="text-foreground font-medium">
                    {leave.days_count} {leave.days_count === 1 ? "day" : "days"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Resume Date</span>
                  <span className="text-foreground font-medium">{safeDateDisplay(leave.resume_date)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t pt-3 text-xs sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Assigned Reliever</span>
                  <span className="text-foreground font-medium">
                    {resolvePersonName(leave.reliever) || "Not assigned"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Department Lead</span>
                  <span className="text-foreground font-medium">
                    {resolvePersonName(leave.supervisor) || "Department Lead"}
                  </span>
                </div>
              </div>

              {/* Applicant's Reason / Justification */}
              <div className="border-t pt-3">
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Applicant&apos;s Justification
                </span>
                <div className="bg-muted/40 text-foreground/90 mt-1 rounded-md border p-2.5 text-xs leading-relaxed italic">
                  &ldquo;{leave.reason || "No explicit reason provided."}&rdquo;
                </div>
              </div>

              {/* Handover Notes (if present as text) */}
              {leave.handover_note &&
                (!leave.handover_checklist_url || !leave.handover_note.startsWith("Attached:")) && (
                  <div className="border-t pt-2.5">
                    <span className="text-muted-foreground block text-[11px] font-medium">Handover Notes</span>
                    <div className="bg-muted/40 text-foreground/90 mt-1 rounded-md border p-2.5 text-xs leading-relaxed">
                      {leave.handover_note}
                    </div>
                  </div>
                )}
            </div>

            {/* Section 2: Approval Timeline & Audit Log */}
            <div className="bg-card space-y-4 rounded-lg border p-4 shadow-xs sm:p-5">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Layers className="text-primary h-3.5 w-3.5" /> Approval Stages & Audit Log
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {timeline.length} stage{timeline.length === 1 ? "" : "s"} recorded
                </span>
              </div>

              {stageAuditMap.size === 0 && leave.admin_manual ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="rounded-full bg-emerald-500 p-1 text-white shadow-xs">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs font-semibold">Direct Admin Manual Approval</span>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600"
                      >
                        Approved
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Approved by{" "}
                      <span className="text-foreground font-medium">
                        {leave.approved_by_profile ? resolvePersonName(leave.approved_by_profile) : "Authorized Admin"}
                      </span>
                    </p>
                    {leave.approved_at && (
                      <p className="text-muted-foreground font-mono text-[11px]">
                        {formatWATDateTime(leave.approved_at)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="before:bg-muted-foreground/20 relative space-y-5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2.5 before:w-[2px]">
                  {stageOrder.map((stageKey, idx) => {
                    const item = stageAuditMap.get(stageKey)
                    const stageActorName =
                      resolvePersonName(item?.approver) ||
                      (stageKey === "reliever"
                        ? resolvePersonName(leave.reliever) || null
                        : stageKey === "department_lead"
                          ? resolvePersonName(leave.supervisor) || null
                          : stageKey === "admin_hr_lead"
                            ? resolvePersonName(leave.approved_by_profile) || null
                            : null)

                    const isCurrent = currentStageKey === stageKey
                    const isStageRejected = item && String(item.status || "").toLowerCase() === "rejected"
                    const isCompleted = Boolean(item) && !isStageRejected

                    let nodeColor = "border-muted-foreground/30 bg-background text-muted-foreground"
                    if (isStageRejected) {
                      nodeColor = "border-red-500 bg-red-500 text-white"
                    } else if (isCompleted) {
                      nodeColor = "border-emerald-500 bg-emerald-500 text-white"
                    } else if (isCurrent) {
                      nodeColor = "border-amber-500 bg-amber-500 text-white animate-pulse"
                    }

                    return (
                      <div key={stageKey} className="group relative">
                        {/* Timeline Node Point */}
                        <div
                          className={cn(
                            "absolute top-0.5 -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-xs transition-colors",
                            nodeColor
                          )}
                        >
                          {isStageRejected ? (
                            <X className="h-3 w-3 stroke-[3]" />
                          ) : isCompleted ? (
                            <Check className="h-3 w-3 stroke-[3]" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        {/* Stage Card */}
                        <div
                          className={cn(
                            "bg-card space-y-2 rounded-lg border p-3.5 shadow-xs transition-colors",
                            isStageRejected && "border-red-200 bg-red-50/20 dark:border-red-950 dark:bg-red-950/10"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-foreground text-xs font-semibold">{stageName[stageKey]}</span>

                            {item ? (
                              <Badge
                                variant={isStageRejected ? "destructive" : "outline"}
                                className={cn(
                                  "text-[10px] font-medium capitalize",
                                  !isStageRejected &&
                                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                {item.status || "Approved"}
                              </Badge>
                            ) : isCurrent ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                              >
                                Awaiting Action
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">
                                {stageKey === "reliever" && !hasRelieverAssignee
                                  ? "Not Required"
                                  : isApproved
                                    ? "Bypassed"
                                    : isRejected
                                      ? "Not Reached"
                                      : "Pending"}
                              </span>
                            )}
                          </div>

                          {item ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="text-muted-foreground flex flex-wrap items-center gap-1.5">
                                <span className="text-foreground font-medium">
                                  {stageActorName ? stageActorName : "Authorized Approver"}
                                </span>
                                {item.approved_at && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-[11px]">{formatWATDateTime(item.approved_at)}</span>
                                  </>
                                )}
                              </div>

                              {item.comments && (
                                <div
                                  className={cn(
                                    "flex items-start gap-2 rounded border p-2.5 text-xs",
                                    isStageRejected
                                      ? "border-red-200 bg-red-50/70 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                                      : "bg-muted/40 text-foreground/90 italic"
                                  )}
                                >
                                  <MessageSquare
                                    className={cn(
                                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                                      isStageRejected ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                                    )}
                                  />
                                  <div className="min-w-0 flex-1">
                                    {isStageRejected && (
                                      <span className="mb-0.5 block font-semibold not-italic">Rejection Reason:</span>
                                    )}
                                    <span>&ldquo;{item.comments}&rdquo;</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs">
                              {stageKey === "reliever" && !hasRelieverAssignee ? (
                                <span className="italic">No reliever assigned for this application</span>
                              ) : stageKey === "reliever" && relieverHandledByLead ? (
                                <span className="italic">
                                  Handled by{" "}
                                  {departmentLeadApproverName ||
                                    resolvePersonName(leave.supervisor) ||
                                    "Department Lead"}
                                </span>
                              ) : isRejected ? (
                                <span className="italic">Stage not reached due to prior rejection</span>
                              ) : isApproved ? (
                                <span className="italic">Bypassed during final authorization</span>
                              ) : (
                                <span className="italic">Pending review by assigned approver</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Evidence & Attachments */}
            <div className="bg-card space-y-3.5 rounded-lg border p-4 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <ShieldCheck className="text-primary h-3.5 w-3.5" /> Evidence & Attachments
                </span>
                <Badge
                  variant={leave.evidence_complete ? "outline" : "secondary"}
                  className={cn(
                    "text-[10px] font-medium",
                    leave.evidence_complete
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : ""
                  )}
                >
                  {leave.evidence_complete ? "All Evidence Complete" : "Pending Evidence"}
                </Badge>
              </div>

              {/* Handover Document / Note */}
              {leave.handover_checklist_url ? (
                <div className="bg-muted/20 flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground text-xs font-semibold">Handover Document</p>
                        <Badge variant="outline" className="border-blue-300 text-[9px] text-blue-600 uppercase">
                          Handover
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {leave.handover_note ? leave.handover_note : "Official handover document submission"}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7.5 shrink-0 gap-1.5 text-xs" asChild>
                    <a
                      href={leaveHandoverHref(leave.id, leave.handover_checklist_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Document
                    </a>
                  </Button>
                </div>
              ) : leave.handover_note ? (
                <div className="bg-muted/20 rounded-lg border p-3 text-xs">
                  <span className="text-muted-foreground block text-[11px] font-semibold uppercase">Handover Note</span>
                  <p className="text-foreground/90 mt-1">{leave.handover_note}</p>
                </div>
              ) : null}

              {/* Uploaded Evidence Files */}
              {leave.evidence && leave.evidence.length > 0 ? (
                <div className="space-y-2">
                  {leave.evidence.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-muted/20 flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary rounded-lg p-2">
                          <FileCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-foreground text-xs font-semibold capitalize">
                              {doc.document_type.replace(/_/g, " ")}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-1.5 py-0 text-[9px] uppercase",
                                doc.status === "verified"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : doc.status === "rejected"
                                    ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              )}
                            >
                              {doc.status}
                            </Badge>
                          </div>
                          {doc.notes && <p className="text-muted-foreground mt-0.5 text-[11px] italic">{doc.notes}</p>}
                        </div>
                      </div>

                      <Button size="sm" variant="outline" className="h-7.5 shrink-0 gap-1.5 text-xs" asChild>
                        <a href={leaveEvidenceHref(doc.id, doc.file_url)} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          View File
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Clean Empty State when neither handover nor evidence was uploaded */}
              {!hasHandover && !hasEvidence && (
                <div className="rounded-lg border border-dashed p-5 text-center">
                  <Paperclip className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
                  <p className="text-foreground text-xs font-medium">No attachments or evidence uploaded</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Handover documents or required supporting evidence appear here once submitted.
                  </p>
                </div>
              )}

              {/* Required Documents Policy Pills */}
              {leave.required_documents && leave.required_documents.length > 0 && (
                <div className="border-t pt-2.5">
                  <span className="text-muted-foreground block text-[10px] font-semibold tracking-wider uppercase">
                    Required Policy Checklist
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {leave.required_documents.map((reqDoc) => (
                      <Badge key={reqDoc} variant="secondary" className="text-[11px] font-normal">
                        {reqDoc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sheet Footer */}
        <SheetFooter className="bg-muted/20 flex flex-row items-center justify-between gap-2 border-t px-5 py-3 sm:px-6">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span className="hidden sm:inline">Request ID:</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleCopy(leave.id, "ID")}
                  className="hover:text-foreground inline-flex items-center gap-1 font-mono transition-colors"
                  aria-label="Copy request ID"
                >
                  <span>{leave.id.slice(0, 8)}...</span>
                  {copiedField === "ID" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-60" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Click to copy request ID</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Close
            </Button>

            {showActionButtons && (onApprove || onReject) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReject?.(leave.id)}
                  className="h-8 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:border-red-900"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => onApprove?.(leave.id)}
                  className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                >
                  <Check className="h-3.5 w-3.5" /> Endorse
                </Button>
              </>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
