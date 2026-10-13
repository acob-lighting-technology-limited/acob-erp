import type { RequisitionFormType } from "./types"

/** A Payment Request must be raised at this amount or more. */
export const PAYMENT_REQUEST_MIN = 30_000
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

/** Total of petty-cash line items, rounded to kobo. */
export function lineItemsTotal(items: { amount: number | string }[]): number {
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  return Math.round(total * 100) / 100
}
