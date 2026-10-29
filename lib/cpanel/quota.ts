/**
 * Mailbox quota thresholds and formatting, shared by the server (alerts, admin
 * report) and the browser (profile card, admin page). No cPanel access here.
 */

/** The bar turns amber. */
export const MAILBOX_WARN_PERCENT = 80
/** The bar turns red and the owner + ICT are emailed. */
export const MAILBOX_ALERT_PERCENT = 90
/** A mailbox must fall back under this before it can alert again. */
export const MAILBOX_ALERT_RESET_PERCENT = 85
/** Quota given to staff mailboxes Matrix creates. */
export const DEFAULT_MAILBOX_QUOTA_MB = 250

export type MailboxLevel = "ok" | "warn" | "alert"

export function mailboxLevel(usedPercent: number | null): MailboxLevel {
  if (usedPercent == null) return "ok"
  if (usedPercent >= MAILBOX_ALERT_PERCENT) return "alert"
  if (usedPercent >= MAILBOX_WARN_PERCENT) return "warn"
  return "ok"
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
  const gb = mb / 1024
  return `${gb < 10 ? gb.toFixed(2).replace(/\.?0+$/, "") : gb.toFixed(1).replace(/\.0$/, "")} GB`
}

export function formatQuota(quotaBytes: number | null): string {
  return quotaBytes == null ? "Unlimited" : formatBytes(quotaBytes)
}

/** Quota steps offered when raising a mailbox, in MB. */
export const MAILBOX_QUOTA_STEPS_MB = [250, 500, 1024, 2048, 5120, 10240, 20480] as const

export function nextQuotaStepMb(currentQuotaBytes: number | null): number {
  const currentMb = currentQuotaBytes == null ? 0 : currentQuotaBytes / (1024 * 1024)
  return (
    MAILBOX_QUOTA_STEPS_MB.find((step) => step > currentMb + 1) ??
    MAILBOX_QUOTA_STEPS_MB[MAILBOX_QUOTA_STEPS_MB.length - 1]
  )
}
