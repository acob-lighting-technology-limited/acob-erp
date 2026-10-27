"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  MessageSquare,
  Paperclip,
  X,
  XCircle,
} from "lucide-react"
import { LeaveItem, approvalStageKey, resolvePersonName, resolveLeaveRouteStages } from "../view"
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"
import { leaveEvidenceHref, leaveHandoverHref } from "@/lib/hr/leave-attachment-links"
import { cn } from "@/lib/utils"

// Shared by the leave side sheet and the expanded table row so both read the
// approval route the same way.

const STAGE_NAME: Record<string, string> = {
  reliever: "Reliever Review",
  department_lead: "Department Lead",
  admin_hr_lead: "Admin and HR Lead",
  hcs: "Head, Corporate Services",
  md: "Managing Director",
}

export function safeDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    return formatWATDate(dateStr)
  } catch {
    return dateStr
  }
}

function leaveStatusFlags(leave: LeaveItem) {
  const statusLower = String(leave.status || "").toLowerCase()
  return {
    isApproved: statusLower === "approved" || statusLower === "completed",
    isRejected: statusLower === "rejected",
    isCancelled: statusLower === "cancelled",
  }
}

function buildStageAudit(leave: LeaveItem) {
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
    const existingTime = existing?.approved_at ? new Date(existing.approved_at).getTime() : 0
    const nextTime = item.approved_at ? new Date(item.approved_at).getTime() : 0
    if (!existing || nextTime >= existingTime) stageAuditMap.set(key, item)
  }

  return { timeline, stageAuditMap }
}

export function SectionHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">{title}</h3>
      {typeof aside === "string" ? <span className="text-muted-foreground text-[11px]">{aside}</span> : aside}
    </div>
  )
}

export function LeaveStatusStrip({ leave }: { leave: LeaveItem }) {
  const { isApproved, isRejected, isCancelled } = leaveStatusFlags(leave)
  const currentStageKey = approvalStageKey(leave.current_stage_code || leave.approval_stage)
  const { timeline } = buildStageAudit(leave)
  const rejectionStageItem = timeline.find((item) => String(item.status || "").toLowerCase() === "rejected")
  // The rejecting stage already shows its comment in the approval stages list
  const strayRejectionReason = rejectionStageItem?.comments ? null : leave.rejected_reason || null

  const title = isApproved
    ? "Approved — all endorsements complete"
    : isRejected
      ? `Rejected${rejectionStageItem ? ` at ${STAGE_NAME[approvalStageKey(rejectionStageItem.stage_code)] || "approval"}` : ""}`
      : isCancelled
        ? "Cancelled"
        : `Awaiting ${STAGE_NAME[currentStageKey] || currentStageKey.replace(/_/g, " ")}`

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs",
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
        <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : isRejected ? (
        <XCircle className="mt-px h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      ) : isCancelled ? (
        <AlertCircle className="text-muted-foreground mt-px h-4 w-4 shrink-0" />
      ) : (
        <Clock className="mt-px h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{title}</p>
        {isRejected && strayRejectionReason && (
          <p className="mt-0.5 leading-relaxed">
            <span className="font-semibold">Reason: </span>&ldquo;{strayRejectionReason}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

export function LeaveOverlapNotice({ leave }: { leave: LeaveItem }) {
  if (!leave.department_overlaps || leave.department_overlaps.length === 0) return null
  return (
    <div className="space-y-1.5 rounded-md border border-amber-300/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>Also off in this department during these dates</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
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
  )
}

function DetailField({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string
  value: string
  className?: string
  valueClassName?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd className={cn("text-foreground mt-0.5 font-medium break-words", valueClassName)}>{value}</dd>
    </div>
  )
}

export function LeaveDetailsList({ leave }: { leave: LeaveItem }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-3">
      <DetailField label="Resume date" value={safeDateDisplay(leave.resume_date)} />
      <DetailField label="Reliever" value={resolvePersonName(leave.reliever) || "Not assigned"} />
      <DetailField label="Department lead" value={resolvePersonName(leave.supervisor) || "—"} />
      <DetailField
        className="col-span-full"
        label="Reason"
        value={leave.reason || "No reason provided."}
        valueClassName="font-normal leading-relaxed"
      />
    </dl>
  )
}

export function LeaveApprovalStages({ leave }: { leave: LeaveItem }) {
  const { isApproved, isRejected, isCancelled } = leaveStatusFlags(leave)
  const { stageAuditMap } = buildStageAudit(leave)
  const stageOrder = resolveLeaveRouteStages(leave)
  const currentStageKey = approvalStageKey(leave.current_stage_code || leave.approval_stage)
  const relieverId = leave.reliever?.id || leave.reliever_id
  const supervisorId = leave.supervisor?.id || leave.supervisor_id
  const hasRelieverAssignee = Boolean(relieverId)
  const relieverHandledByLead =
    Boolean(relieverId) && relieverId === supervisorId && Boolean(stageAuditMap.get("department_lead"))
  const departmentLeadApproverName = resolvePersonName(stageAuditMap.get("department_lead")?.approver)
  const advancedPastReliever = ["department_lead", "admin_hr_lead", "hcs", "md"].includes(currentStageKey)
  const recordedStages = stageOrder.filter((stageKey) => stageAuditMap.has(stageKey)).length

  return (
    <section className="space-y-3">
      <SectionHeading title="Approval stages" aside={`${recordedStages} of ${stageOrder.length} recorded`} />

      {stageAuditMap.size === 0 && leave.admin_manual ? (
        <div className="flex items-start gap-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3 w-3 stroke-[3]" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground font-medium">Direct admin approval</span>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600">
                Approved
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              {leave.approved_by_profile ? resolvePersonName(leave.approved_by_profile) : "Authorized Admin"}
              {leave.approved_at && ` • ${formatWATDateTime(leave.approved_at)}`}
            </p>
          </div>
        </div>
      ) : (
        <ol className="before:bg-border relative space-y-3 before:absolute before:top-2.5 before:bottom-2.5 before:left-[9px] before:w-px">
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
            const isOpen = !isApproved && !isRejected && !isCancelled

            let nodeColor = "border-muted-foreground/30 bg-background text-muted-foreground"
            if (isStageRejected) {
              nodeColor = "border-red-500 bg-red-500 text-white"
            } else if (isCompleted) {
              nodeColor = "border-emerald-500 bg-emerald-500 text-white"
            } else if (isCurrent && isOpen) {
              nodeColor = "border-amber-500 bg-amber-500 text-white"
            }

            const pendingLabel =
              stageKey === "reliever" && !hasRelieverAssignee
                ? "Not required"
                : stageKey === "reliever" && relieverHandledByLead
                  ? "Handled by lead"
                  : isCancelled
                    ? "Cancelled"
                    : isRejected
                      ? "Not reached"
                      : isApproved || (stageKey === "reliever" && advancedPastReliever)
                        ? "Bypassed"
                        : "Pending"

            // Only say something under a pending stage when it adds information
            const pendingNote =
              stageKey === "reliever" && !hasRelieverAssignee
                ? "No reliever assigned for this application"
                : stageKey === "reliever" && relieverHandledByLead
                  ? `Handled by ${departmentLeadApproverName || resolvePersonName(leave.supervisor) || "Department Lead"}`
                  : isOpen
                    ? stageActorName
                    : null

            return (
              <li key={stageKey} className="relative flex gap-3">
                <div
                  className={cn(
                    "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
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

                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex min-h-5 flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={cn("font-medium", item || isCurrent ? "text-foreground" : "text-muted-foreground")}
                    >
                      {STAGE_NAME[stageKey]}
                    </span>

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
                    ) : isCurrent && isOpen ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                      >
                        Awaiting action
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">{pendingLabel}</span>
                    )}
                  </div>

                  {item ? (
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      <span className="text-foreground/90">{stageActorName || "Authorized Approver"}</span>
                      {item.approved_at && ` • ${formatWATDateTime(item.approved_at)}`}
                    </p>
                  ) : (
                    pendingNote && <p className="text-muted-foreground mt-0.5 text-[11px]">{pendingNote}</p>
                  )}

                  {item?.comments && (
                    <div
                      className={cn(
                        "mt-1.5 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5",
                        isStageRejected
                          ? "border-red-200 bg-red-50/70 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                          : "bg-muted/40 text-foreground/90"
                      )}
                    >
                      <MessageSquare
                        className={cn(
                          "mt-0.5 h-3 w-3 shrink-0",
                          isStageRejected ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                        )}
                      />
                      <span className="min-w-0 flex-1">&ldquo;{item.comments}&rdquo;</span>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function AttachmentRow({
  icon,
  iconClassName,
  title,
  badge,
  subtitle,
  href,
}: {
  icon: ReactNode
  iconClassName: string
  title: string
  badge?: ReactNode
  subtitle?: string | null
  href: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border px-2.5 py-2">
      <div className={cn("shrink-0 rounded-md p-1.5", iconClassName)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-foreground truncate text-xs font-medium capitalize">{title}</p>
          {badge}
        </div>
        {subtitle && <p className="text-muted-foreground truncate text-[11px]">{subtitle}</p>}
      </div>
      <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-2 text-xs" asChild>
        <a href={href} target="_blank" rel="noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          View
        </a>
      </Button>
    </div>
  )
}

export function LeaveAttachments({ leave }: { leave: LeaveItem }) {
  const hasHandover = Boolean(leave.handover_checklist_url || leave.handover_note)
  const hasEvidence = Boolean(leave.evidence && leave.evidence.length > 0)
  const handoverNote = leave.handover_note && !leave.handover_note.startsWith("Attached:") ? leave.handover_note : null

  return (
    <section className="space-y-2.5">
      <SectionHeading
        title="Attachments"
        aside={
          <Badge
            variant={leave.evidence_complete ? "outline" : "secondary"}
            className={cn(
              "text-[10px] font-medium",
              leave.evidence_complete &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {leave.evidence_complete ? "Evidence complete" : "Evidence pending"}
          </Badge>
        }
      />

      {leave.handover_checklist_url ? (
        <AttachmentRow
          icon={<FileText className="h-4 w-4" />}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          title="Handover document"
          subtitle={handoverNote}
          href={leaveHandoverHref(leave.id, leave.handover_checklist_url)}
        />
      ) : handoverNote ? (
        <div className="bg-muted/30 rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground block text-[11px]">Handover note</span>
          <p className="text-foreground/90 mt-0.5 leading-relaxed">{handoverNote}</p>
        </div>
      ) : null}

      {leave.evidence?.map((doc) => (
        <AttachmentRow
          key={doc.id}
          icon={<FileCheck className="h-4 w-4" />}
          iconClassName="bg-primary/10 text-primary"
          title={doc.document_type.replace(/_/g, " ")}
          badge={
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
          }
          subtitle={doc.notes}
          href={leaveEvidenceHref(doc.id, doc.file_url)}
        />
      ))}

      {!hasHandover && !hasEvidence && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Paperclip className="h-3.5 w-3.5" /> No handover document or evidence uploaded.
        </p>
      )}

      {leave.required_documents && leave.required_documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-muted-foreground text-[11px]">Required:</span>
          {leave.required_documents.map((reqDoc) => (
            <Badge key={reqDoc} variant="secondary" className="text-[11px] font-normal">
              {reqDoc}
            </Badge>
          ))}
        </div>
      )}
    </section>
  )
}
