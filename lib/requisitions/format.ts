import { FORM_LABELS } from "./limits"
import { STAGE_LABELS } from "./routing"
import type { Requisition, RequisitionStage, RequisitionStatus } from "./types"

export function formatNaira(value: number | string | null | undefined): string {
  const amount = Number(value) || 0
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const STATUS_LABELS: Record<RequisitionStatus, string> = {
  pending: "In approval",
  awaiting_payment: "Awaiting payment",
  partly_paid: "Partly paid",
  paid: "Paid",
  rejected: "Rejected",
}

/** "Authorized — Technical Lead" */
export function stageTitle(stage: Pick<RequisitionStage, "stage_code" | "role_label">): string {
  return `${STAGE_LABELS[stage.stage_code]} — ${stage.role_label}`
}

/** One line saying where a requisition is: the stage it waits on, or its status. */
export function progressLabel(req: Requisition): string {
  if (req.status !== "pending") {
    if (req.status === "partly_paid")
      return `Partly paid: ${formatNaira(req.amount_paid)} of ${formatNaira(req.amount)}`
    return STATUS_LABELS[req.status]
  }
  const stage = [...(req.stages || [])].sort((a, b) => a.position - b.position).find((s) => s.state === "pending")
  if (!stage) return STATUS_LABELS.pending
  const who = stage.assignee?.full_name || "unassigned"
  return `Awaiting ${STAGE_LABELS[stage.stage_code].toLowerCase()}: ${who}`
}

/** What the requisition is for, in one line, for lists and notifications. */
export function requisitionSummary(req: Pick<Requisition, "form_type" | "purpose" | "line_items">): string {
  if (req.form_type === "petty_cash") {
    const items = req.line_items || []
    if (!items.length) return FORM_LABELS.petty_cash
    const first = items[0].description
    return items.length > 1 ? `${first} and ${items.length - 1} more` : first
  }
  return req.purpose || ""
}
