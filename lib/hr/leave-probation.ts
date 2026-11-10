/**
 * Probation rule: until HR records a confirmation date, staff may take only Sick Leave and
 * Leave Without Pay. This applies to everyone — full-time, contract, corpers and interns alike.
 * A blank confirmation date counts as unconfirmed, so HR must record the date to lift it.
 *
 * Pure so it can be unit-tested; the DB lookup lives in leave-workflow.ts.
 */
export const PROBATION_ALLOWED_LEAVE_CODES = ["SICK", "LWOP"] as const

export type LeaveConfirmationState = {
  confirmationDate: string | null
}

export function isConfirmedOn(state: LeaveConfirmationState, date: string): boolean {
  return Boolean(state.confirmationDate && state.confirmationDate <= date)
}

/** True when the probation rule blocks this leave type for a leave starting on `startDate`. */
export function isBlockedByProbation(
  state: LeaveConfirmationState,
  leaveCode: string | null | undefined,
  startDate: string
): boolean {
  if (isConfirmedOn(state, startDate)) return false
  return !(PROBATION_ALLOWED_LEAVE_CODES as readonly string[]).includes((leaveCode || "").toUpperCase())
}
