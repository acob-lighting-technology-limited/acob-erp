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

function currentStage(req: Requisition) {
  if (req.status !== "pending") return null
  return orderedStages(req).find((s) => s.state === "pending") || null
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
          ? { text: "Awaiting action", tone: "warning" }
          : { text: closed ? "Not reached" : "Pending", tone: "muted" },
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
  if (req.status === "paid") {
    return { node: "done" as Node, badge: { text: "Paid", tone: "success" as const }, who: names }
  }
  if (req.status === "awaiting_payment" || req.status === "partly_paid") {
    return {
      node: "current" as Node,
      badge: { text: req.status === "partly_paid" ? "Partly paid" : "Awaiting payment", tone: "warning" as const },
      who: names,
    }
  }
  return { node: "idle" as Node, badge: { text: "After approval", tone: "muted" as const }, who: names }
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

  return (
    <section className={cn("space-y-3", className)}>
      {heading ? <SectionHeading title="Approval stages" aside={`${recorded} of ${stages.length} recorded`} /> : null}
      {stages.length === 0 ? (
        <p className="text-muted-foreground text-xs">No approval stages recorded.</p>
      ) : (
        <ol className="before:bg-border relative space-y-3 before:absolute before:top-2.5 before:bottom-2.5 before:left-[9px] before:w-px">
          {stages.map((stage, idx) => {
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
                    <span
                      className={cn("font-medium", v.node === "idle" ? "text-muted-foreground" : "text-foreground")}
                    >
                      {STAGE_LABELS[stage.stage_code]} — {stage.role_label}
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
                        v.node === "rejected"
                          ? "border-danger/30 bg-danger/15 text-danger"
                          : "bg-muted/40 text-foreground/90"
                      )}
                    >
                      <MessageSquare
                        className={cn(
                          "mt-0.5 h-3 w-3 shrink-0",
                          v.node === "rejected" ? "text-danger" : "text-muted-foreground"
                        )}
                      />
                      <span className="min-w-0 flex-1">&ldquo;{stage.comments}&rdquo;</span>
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {payment ? (
        <div className="rounded-md border border-dashed border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400">
              {payment.node === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
              Payment officer
            </span>
            <span className="text-xs font-medium text-sky-600 dark:text-sky-400">{payment.badge.text}</span>
          </div>
          <p className="text-foreground/90 mt-1">{payment.who}</p>
          <p className="text-muted-foreground mt-0.5">Not an approval. Records the payment to close this out.</p>
        </div>
      ) : null}
    </section>
  )
}
