import { AlertCircle, Check, CheckCircle2, Clock, MessageSquare, Wallet, X, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SectionHeading } from "@/components/ui/detail-list"
import { formatNaira } from "@/lib/requisitions/format"
import { isRaisedByHolder, STAGE_LABELS } from "@/lib/requisitions/routing"
import type { Requisition, RequisitionStage } from "@/lib/requisitions/types"
import { cn } from "@/lib/utils"
import { formatWATDateTime } from "@/lib/utils/date"

/**
 * A requisition's approval route, drawn the way leave draws its own (see
 * leave-detail-sections.tsx): a status strip, then a numbered timeline with a
 * badge per stage. Used by the list's expanded row, the preview sheet and the
 * full page.
 */

export function when(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  })
}

function orderedStages(req: Requisition) {
  return [...(req.stages || [])].sort((a, b) => a.position - b.position)
}

/** Mirrors isStageOpen on the server: a Payment Request's Approved stage opens once it is paid. */
function isOpen(req: Requisition, stage: RequisitionStage) {
  if (req.form_type !== "payment_request") return req.status === "pending"
  if (req.status === "awaiting_approval") return stage.stage_code === "approved"
  return req.status === "pending" && stage.stage_code !== "approved"
}

function currentStage(req: Requisition) {
  return orderedStages(req).find((s) => s.state === "pending" && isOpen(req, s)) || null
}

/** One coloured line saying where the requisition stands. */
export function RequisitionStatusStrip({ requisition: req }: { requisition: Requisition }) {
  const current = currentStage(req)
  const rejectedAt = orderedStages(req).find((s) => s.state === "rejected")
  // The rejecting stage shows its own comment in the timeline.
  const strayReason = rejectedAt?.comments ? null : req.rejection_reason || null

  let tone: "success" | "danger" | "warning" = "warning"
  let icon = <Clock className="text-warning mt-px h-4 w-4 shrink-0" />
  let title: string
  if (req.status === "paid") {
    tone = "success"
    icon = <CheckCircle2 className="text-success mt-px h-4 w-4 shrink-0" />
    title = `Paid in full · ${formatNaira(req.amount_paid)}`
  } else if (req.status === "rejected") {
    tone = "danger"
    icon = <XCircle className="text-danger mt-px h-4 w-4 shrink-0" />
    title = `Rejected${rejectedAt ? ` at ${rejectedAt.role_label}` : ""}`
  } else if (req.status === "awaiting_payment") {
    icon = <Wallet className="text-warning mt-px h-4 w-4 shrink-0" />
    title = "Fully signed — awaiting payment"
  } else if (req.status === "scheduled") {
    icon = <Wallet className="text-warning mt-px h-4 w-4 shrink-0" />
    title = "Verified — on a payment schedule, waiting for the bank"
  } else if (req.status === "awaiting_approval") {
    tone = "success"
    icon = <CheckCircle2 className="text-success mt-px h-4 w-4 shrink-0" />
    title = `Paid · awaiting ${current?.assignee?.full_name || "the MD"}'s approval`
  } else if (req.status === "partly_paid") {
    icon = <Wallet className="text-warning mt-px h-4 w-4 shrink-0" />
    title = `Partly paid — ${formatNaira(req.amount_paid)} of ${formatNaira(req.amount)}`
  } else if (current) {
    title = `Awaiting ${current.role_label}${current.assignee?.full_name ? ` · ${current.assignee.full_name}` : ""}`
  } else {
    icon = <AlertCircle className="text-warning mt-px h-4 w-4 shrink-0" />
    title = "In approval"
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs",
        tone === "success" && "border-success/30 bg-success/15 text-success",
        tone === "danger" && "border-danger/30 bg-danger/15 text-danger",
        tone === "warning" && "border-warning/30 bg-warning/15 text-warning"
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{title}</p>
        {strayReason ? (
          <p className="mt-0.5 leading-relaxed">
            <span className="font-semibold">Reason: </span>&ldquo;{strayReason}&rdquo;
          </p>
        ) : null}
      </div>
    </div>
  )
}

type Node = "done" | "rejected" | "current" | "idle"

interface StageView {
  node: Node
  /** Right-hand badge, or plain muted text when there is nothing to celebrate. */
  badge: { text: string; tone: "success" | "danger" | "warning" | "muted" }
  /** Name and time under the title. */
  who: string | null
  at: string | null
  /** Why a stage moved or was skipped, when the badge does not already say it. */
  note: string | null
}

function viewStage(req: Requisition, stage: RequisitionStage, current: RequisitionStage | null): StageView {
  const note = stage.state_note
  switch (stage.state) {
    case "signed":
      return {
        node: "done",
        badge: { text: "Signed", tone: "success" },
        who: stage.actor?.full_name || null,
        at: stage.acted_at,
        note,
      }
    case "rejected":
      return {
        node: "rejected",
        badge: { text: "Rejected", tone: "danger" },
        who: stage.actor?.full_name || null,
        at: stage.acted_at,
        note,
      }
    case "bypassed":
      return {
        node: "idle",
        badge: { text: "Bypassed", tone: "muted" },
        who: stage.actor?.full_name ? `By ${stage.actor.full_name}` : null,
        at: stage.acted_at,
        note,
      }
    case "not_required":
      // The requester holds this role: their submission stands as the signature.
      return isRaisedByHolder(stage)
        ? {
            node: "done",
            badge: { text: "Requester", tone: "success" },
            who: req.requester?.full_name || null,
            at: req.created_at,
            note: null,
          }
        : { node: "idle", badge: { text: "Not required", tone: "muted" }, who: null, at: null, note }
    default: {
      const isCurrent = current?.id === stage.id
      const closed = req.status === "rejected"
      return {
        node: isCurrent ? "current" : "idle",
        badge: isCurrent
          ? { text: req.status === "awaiting_approval" ? "Awaiting approval" : "Awaiting action", tone: "warning" }
          : {
              text: closed
                ? "Not reached"
                : req.form_type === "payment_request" && stage.stage_code === "approved"
                  ? "After payment"
                  : "Pending",
              tone: "muted",
            },
        who: closed ? null : stage.assignee?.full_name || "Nobody assigned",
        at: null,
        note,
      }
    }
  }
}

const NODE_CLASS: Record<Node, string> = {
  done: "border-emerald-500 bg-emerald-500 text-white",
  rejected: "border-red-500 bg-red-500 text-white",
  current: "border-amber-500 bg-amber-500 text-white",
  idle: "border-muted-foreground/30 bg-background text-muted-foreground",
}

const BADGE_CLASS = {
  success: "border-success/30 bg-success/15 text-success",
  danger: "border-danger/30 bg-danger/15 text-danger",
  warning: "border-warning/30 bg-warning/15 text-warning",
} as const

/** The last step: someone records the payment. Shown with the officers who can. */
function paymentStep(req: Requisition, stages: RequisitionStage[]) {
  if (!stages.length || req.status === "rejected") return null
  const officers = (req.payment_officers || []).map((p) => p.full_name).filter(Boolean)
  const names = officers.length ? officers.join(", ") : "No payment officer set"
  // Once money has gone out, show who recorded it and when, newest first.
  const recorded = [...(req.payments || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const last = recorded[0]
  const paidBy = last ? last.recorder?.full_name || names : names
  const at = last ? last.created_at : null
  if (req.status === "paid" || req.status === "awaiting_approval") {
    return { node: "done" as Node, badge: { text: "Paid", tone: "success" as const }, who: paidBy, at }
  }
  if (req.status === "awaiting_payment" || req.status === "partly_paid" || req.status === "scheduled") {
    const text =
      req.status === "partly_paid"
        ? "Partly paid"
        : req.status === "scheduled"
          ? "On a payment schedule"
          : "Awaiting payment"
    return {
      node: "current" as Node,
      badge: { text, tone: "warning" as const },
      who: req.status === "partly_paid" ? paidBy : names,
      at: req.status === "partly_paid" ? at : null,
    }
  }
  const after = req.form_type === "payment_request" ? "After verification" : "After approval"
  return { node: "idle" as Node, badge: { text: after, tone: "muted" as const }, who: names, at: null }
}

function StageRow({
  requisition,
  stage,
  idx,
  current,
}: {
  requisition: Requisition
  stage: RequisitionStage
  idx: number
  current: RequisitionStage | null
}) {
  const v = viewStage(requisition, stage, current)
  return (
    <li key={stage.id} className="relative flex gap-3">
      <div
        className={cn(
          "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
          NODE_CLASS[v.node]
        )}
      >
        {v.node === "rejected" ? (
          <X className="h-3 w-3 stroke-[3]" />
        ) : v.node === "done" ? (
          <Check className="h-3 w-3 stroke-[3]" />
        ) : (
          <span>{idx + 1}</span>
        )}
      </div>

      <div className="min-w-0 flex-1 text-xs">
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-1.5">
          <span className={cn("font-medium", v.node === "idle" ? "text-muted-foreground" : "text-foreground")}>
            {/* A skipped stage names no one: its role would suggest a signature that is not needed. */}
            {stage.state === "not_required" && !isRaisedByHolder(stage)
              ? STAGE_LABELS[stage.stage_code]
              : `${STAGE_LABELS[stage.stage_code]} — ${stage.role_label}`}
          </span>
          {v.badge.tone === "muted" ? (
            <span className="text-muted-foreground text-xs">{v.badge.text}</span>
          ) : (
            <Badge variant="outline" className={cn("text-xs font-medium", BADGE_CLASS[v.badge.tone])}>
              {v.badge.text}
            </Badge>
          )}
        </div>

        {v.who || v.at ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {v.who ? <span className="text-foreground/90">{v.who}</span> : null}
            {v.who && v.at ? " • " : null}
            {v.at ? formatWATDateTime(v.at) : null}
          </p>
        ) : null}
        {v.note ? <p className="text-muted-foreground mt-0.5 text-xs italic">{v.note}</p> : null}

        {stage.comments ? (
          <div
            className={cn(
              "mt-1.5 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5",
              v.node === "rejected" ? "border-danger/30 bg-danger/15 text-danger" : "bg-muted/40 text-foreground/90"
            )}
          >
            <MessageSquare
              className={cn("mt-0.5 h-3 w-3 shrink-0", v.node === "rejected" ? "text-danger" : "text-muted-foreground")}
            />
            <span className="min-w-0 flex-1">&ldquo;{stage.comments}&rdquo;</span>
          </div>
        ) : null}
      </div>
    </li>
  )
}

export function RequisitionStageList({
  requisition,
  heading = true,
  className,
}: {
  requisition: Requisition
  heading?: boolean
  className?: string
}) {
  const stages = orderedStages(requisition)
  const current = currentStage(requisition)
  const recorded = stages.filter((s) => s.state !== "pending").length
  const payment = paymentStep(requisition, stages)
  // A Payment Request is paid before the MD signs Approved, so payment sits between them.
  const paysFirst = requisition.form_type === "payment_request"
  const before = paysFirst ? stages.filter((s) => s.stage_code !== "approved") : stages
  const after = paysFirst ? stages.filter((s) => s.stage_code === "approved") : []

  return (
    <section className={cn("space-y-3", className)}>
      {heading ? <SectionHeading title="Approval stages" aside={`${recorded} of ${stages.length} recorded`} /> : null}
      {stages.length === 0 ? (
        <p className="text-muted-foreground text-xs">No approval stages recorded.</p>
      ) : (
        <ol className="before:bg-border relative space-y-3 before:absolute before:top-2.5 before:bottom-2.5 before:left-[9px] before:w-px">
          {before.map((stage, idx) => (
            <StageRow key={stage.id} requisition={requisition} stage={stage} idx={idx} current={current} />
          ))}
        </ol>
      )}
      {payment ? (
        <div className="border-info/30 bg-info/10 rounded-md border border-dashed px-3 py-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-info flex items-center gap-1.5 font-medium">
              {payment.node === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
              Payment officer
            </span>
            <span className="text-info text-xs font-medium">{payment.badge.text}</span>
          </div>
          <p className="text-muted-foreground mt-1">
            <span className="text-foreground/90">{payment.who}</span>
            {payment.at ? ` • ${formatWATDateTime(payment.at)}` : null}
          </p>
          {payment.node === "done" ? null : (
            <p className="text-muted-foreground mt-0.5">
              {requisition.form_type === "payment_request"
                ? "Not an approval. Puts it on a payment schedule and records what the bank paid."
                : "Not an approval. Records the payment to close this out."}
            </p>
          )}
        </div>
      ) : null}
      {after.length ? (
        <ol className="space-y-3">
          {after.map((stage, idx) => (
            <StageRow
              key={stage.id}
              requisition={requisition}
              stage={stage}
              idx={before.length + idx}
              current={current}
            />
          ))}
        </ol>
      ) : null}
    </section>
  )
}
