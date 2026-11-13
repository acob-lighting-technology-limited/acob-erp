"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Check, CheckCircle2, Clock, FileText, Paperclip, RotateCcw, X, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { LinesSkeleton } from "@/components/skeletons"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { formatWATDateTime } from "@/lib/utils/date"
import type {
  CorrespondenceApproval,
  CorrespondenceRecord,
  CorrespondenceStatus,
  CorrespondenceVersion,
} from "@/types/correspondence"

type Decision = "approved" | "rejected" | "returned_for_correction"

const STAGE_NAME: Record<string, string> = {
  dept_review: "Department review",
  department_review: "Department review",
  exec_review: "Executive review",
  executive_review: "Executive review",
}

const APPROVAL_BADGE: Record<string, { text: string; className: string }> = {
  approved: { text: "Approved", className: "border-success/30 bg-success/15 text-success" },
  rejected: { text: "Rejected", className: "border-danger/30 bg-danger/15 text-danger" },
  returned_for_correction: { text: "Returned", className: "border-warning/30 bg-warning/15 text-warning" },
}

type Tone = "success" | "danger" | "muted" | "warning"

function toneFor(status: CorrespondenceStatus): Tone {
  if (["approved", "sent", "filed", "closed"].includes(status)) return "success"
  if (status === "rejected") return "danger"
  if (status === "cancelled" || status === "draft") return "muted"
  return "warning"
}

/** The one-line banner under the heading: where this correspondence stands. */
function StatusStrip({ status, label }: { status: CorrespondenceStatus; label: string }) {
  const tone = toneFor(status)
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" ? XCircle : tone === "muted" ? AlertCircle : Clock
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs",
        tone === "success" && "border-success/30 bg-success/15 text-success",
        tone === "danger" && "border-danger/30 bg-danger/15 text-danger",
        tone === "muted" && "border-muted bg-muted/40 text-muted-foreground",
        tone === "warning" && "border-warning/30 bg-warning/15 text-warning"
      )}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <p className="text-xs font-medium">{label}</p>
    </div>
  )
}

function ApprovalStages({
  approvals,
  status,
  loading,
}: {
  approvals: CorrespondenceApproval[]
  status: CorrespondenceStatus
  loading: boolean
}) {
  const decided = approvals.filter((a) => a.status !== "pending").length
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Approval stages"
        aside={approvals.length ? `${decided} of ${approvals.length} recorded` : undefined}
      />
      {loading ? (
        <LinesSkeleton lines={2} />
      ) : approvals.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {status === "draft" ? "Not sent for review yet." : "No approval stages recorded."}
        </p>
      ) : (
        <ol className="before:bg-border relative space-y-3 before:absolute before:top-2.5 before:bottom-2.5 before:left-[9px] before:w-px">
          {approvals.map((approval, idx) => {
            const badge = APPROVAL_BADGE[approval.status]
            const pending = approval.status === "pending"
            const nodeClass =
              approval.status === "approved"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : approval.status === "rejected"
                  ? "border-red-500 bg-red-500 text-white"
                  : approval.status === "returned_for_correction"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-500 bg-amber-500 text-white"
            return (
              <li key={approval.id} className="relative flex gap-3">
                <div
                  className={cn(
                    "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    nodeClass
                  )}
                >
                  {approval.status === "approved" ? (
                    <Check className="h-3 w-3 stroke-[3]" />
                  ) : approval.status === "rejected" ? (
                    <X className="h-3 w-3 stroke-[3]" />
                  ) : approval.status === "returned_for_correction" ? (
                    <RotateCcw className="h-3 w-3 stroke-[3]" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex min-h-5 flex-wrap items-center justify-between gap-1.5">
                    <span className="text-foreground font-medium">
                      {STAGE_NAME[approval.approval_stage] || approval.approval_stage.replace(/_/g, " ")}
                    </span>
                    {pending ? (
                      <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning text-xs">
                        Awaiting action
                      </Badge>
                    ) : badge ? (
                      <Badge variant="outline" className={cn("text-xs font-medium", badge.className)}>
                        {badge.text}
                      </Badge>
                    ) : null}
                  </div>
                  {approval.approver_name || approval.decided_at ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {approval.approver_name}
                      {approval.decided_at ? ` • ${formatWATDateTime(approval.decided_at)}` : ""}
                    </p>
                  ) : null}
                  {approval.comments ? (
                    <p className="bg-muted/30 mt-1.5 rounded-md border px-2.5 py-1.5 leading-relaxed">
                      &ldquo;{approval.comments}&rdquo;
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function AttachmentRow({ title, subtitle, href }: { title: string; subtitle: string | null; href: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <div className="bg-info/10 text-info flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <p className="text-foreground truncate font-medium">{title}</p>
        {subtitle ? <p className="text-muted-foreground truncate">{subtitle}</p> : null}
      </div>
      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
        <a href={href} target="_blank" rel="noreferrer">
          View
        </a>
      </Button>
    </div>
  )
}

function Attachments({
  record,
  versions,
  loading,
}: {
  record: CorrespondenceRecord
  versions: CorrespondenceVersion[]
  loading: boolean
}) {
  const files = versions.filter((v) => v.file_path)
  const documentHref = (path: string) =>
    `/api/correspondence/records/${record.id}/documents?mode=download&path=${encodeURIComponent(path)}`
  const count = files.length + (record.proof_of_delivery_path ? 1 : 0)
  return (
    <section className="space-y-2.5">
      <SectionHeading title="Attachments" aside={count ? String(count) : undefined} />
      {files.map((version) => (
        <AttachmentRow
          key={version.id}
          title={`Version ${version.version_no}`}
          subtitle={version.change_summary || formatWATDateTime(version.created_at)}
          href={documentHref(version.file_path as string)}
        />
      ))}
      {record.proof_of_delivery_path ? (
        <AttachmentRow
          title="Proof of delivery"
          subtitle={record.sent_at ? formatWATDateTime(record.sent_at) : null}
          href={documentHref(record.proof_of_delivery_path)}
        />
      ) : null}
      {!loading && count === 0 ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Paperclip className="h-3.5 w-3.5" /> No documents uploaded.
        </p>
      ) : null}
    </section>
  )
}

/**
 * A correspondence record's expanded row, laid out like leave's and requisitions':
 * overview and status on the left; approval stages and attachments on the right.
 */
export function CorrespondenceRowPanel({
  record,
  statusText,
  onDecide,
  deciding,
}: {
  record: CorrespondenceRecord
  statusText: string
  onDecide: (decision: Decision) => void
  deciding: boolean
}) {
  const [approvals, setApprovals] = useState<CorrespondenceApproval[]>([])
  const [versions, setVersions] = useState<CorrespondenceVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiFetch(`/api/correspondence/records/${record.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        setApprovals(json?.data?.approvals ?? [])
        setVersions(json?.data?.versions ?? [])
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [record.id, record.status])

  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
      <div className="space-y-3">
        <SectionHeading title="Correspondence overview" />
        <StatusStrip status={record.status} label={statusText} />
        <DetailList
          items={[
            { label: "Reference", value: record.reference_number },
            { label: "Department", value: record.department_name || record.assigned_department_name || null },
            {
              label: "Recipient",
              value: record.recipient_name
                ? `${record.recipient_name}${record.recipient_code ? ` (${record.recipient_code})` : ""}`
                : null,
            },
            { label: "Requested by", value: record.sender_name || null },
            ...(record.created_by_name && record.created_by_name !== record.sender_name
              ? [{ label: "Created by", value: record.created_by_name }]
              : []),
            { label: "Due date", value: record.due_date || null },
            { label: "Action required", value: record.action_required ? "Yes" : "No" },
            { label: "Subject", value: record.subject, wide: true },
          ]}
        />
      </div>

      <div className="space-y-5">
        <ApprovalStages approvals={approvals} status={record.status} loading={loading} />
        <Attachments record={record} versions={versions} loading={loading} />
      </div>

      {record.status === "under_review" ? (
        <div className="flex flex-wrap gap-2 border-t pt-3 md:col-span-2">
          <Button onClick={() => onDecide("approved")} disabled={deciding} className="gap-2">
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => onDecide("returned_for_correction")}
            disabled={deciding}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Return for correction
          </Button>
          <Button variant="destructive" onClick={() => onDecide("rejected")} disabled={deciding} className="gap-2">
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      ) : null}
    </div>
  )
}
