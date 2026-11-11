import type { RequisitionFormType } from "./types"

/** A Payment Request must be raised at this amount or more. */
export const PAYMENT_REQUEST_MIN = 50_000
/** Petty cash can never exceed this, before or after a signer's change. */
export const PETTY_CASH_MAX = 50_000

export const MAX_BENEFICIARIES: Record<RequisitionFormType, number> = {
  payment_request: 4,
  petty_cash: 2,
}

export const FORM_LABELS: Record<RequisitionFormType, string> = {
  payment_request: "Payment Request",
  petty_cash: "Petty Cash",
}

/** Maximum number of attachments allowed on a single requisition. */
export const REQUISITION_ATTACHMENT_MAX_COUNT = 20
/** Maximum allowed size for any single attachment file (10 MB). */
export const REQUISITION_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024
/** Maximum combined size across all attachments on a requisition (20 MB). */
export const REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024

function naira(value: number): string {
  return `₦${value.toLocaleString("en-NG")}`
}

/**
 * Why this amount cannot be raised on this form, or null when it can.
 * Amounts between the two limits may use either form.
 */
export function amountOutOfRangeMessage(formType: RequisitionFormType, amount: number): string | null {
  if (formType === "payment_request" && amount < PAYMENT_REQUEST_MIN) {
    return `Payment Requests start at ${naira(PAYMENT_REQUEST_MIN)}. Use Petty Cash for this amount.`
  }
  if (formType === "petty_cash" && amount > PETTY_CASH_MAX) {
    return `Petty Cash is capped at ${naira(PETTY_CASH_MAX)}. Use a Payment Request for this amount.`
  }
  return null
}

/** Why a signer cannot change the amount to this figure, or null when they can. */
export function amountChangeMessage(
  formType: RequisitionFormType,
  currentAmount: number,
  newAmount: number
): string | null {
  if (!Number.isFinite(newAmount) || newAmount <= 0) return "Enter an amount greater than zero."
  if (newAmount === currentAmount) return "The new amount is the same as the current one."
  if (formType === "petty_cash" && newAmount > PETTY_CASH_MAX) {
    return `Petty Cash cannot go above ${naira(PETTY_CASH_MAX)}.`
  }
  // A Payment Request may be reduced below the floor: it was valid when raised.
  return null
}

/**
 * What a typed or pasted amount means: "1,200,000", "₦50,000.00" and "NGN 3 500" all read as numbers.
 * Anything that is not a digit or the decimal point is dropped; two decimal points read as nothing.
 */
export function parseNaira(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "")
  if (!cleaned || cleaned.split(".").length > 2) return 0
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The text to keep in an amount box: pasted separators and symbols are removed as they land, two decimals at most. */
export function cleanAmountInput(value: string): string {
  const [whole, ...rest] = value.replace(/[^\d.]/g, "").split(".")
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole
}

/** Total of petty-cash line items, rounded to kobo. */
export function lineItemsTotal(items: { amount: number | string }[]): number {
  const total = items.reduce((sum, item) => sum + parseNaira(item.amount), 0)
  return Math.round(total * 100) / 100
}
