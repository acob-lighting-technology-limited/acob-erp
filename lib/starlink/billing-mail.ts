/**
 * Reading Starlink's billing emails. Every kit's Starlink login forwards to the
 * ict mailbox, and each billing email names the kit's customer account (ACC-...),
 * which is how it is matched to a kit in `starlink_sites.serial_number`.
 *
 * Pure parsing only — no I/O — so it can be tested against real email text.
 */

export type StarlinkMailKind = "reminder" | "processed" | "failed"

export type ParsedStarlinkMail = {
  kind: StarlinkMailKind
  accountNumber: string | null
  amount: number | null
  currency: string | null
  /** Starlink invoice number (INV-...); a reminder carries it as its PDF's name. */
  invoiceNumber: string | null
  /** Billing period, ISO dates. Only reminders state it. */
  periodStart: string | null
  periodEnd: string | null
}

const SUBJECT_KINDS: Record<string, StarlinkMailKind> = {
  "automatic payment reminder": "reminder",
  "payment processed": "processed",
  "starlink payment failed": "failed",
}

export const STARLINK_SENDER = "no-reply@starlink.com"

/** Billing emails only; verification codes and marketing return null. */
export function classifyStarlinkMail(subject: string | null | undefined): StarlinkMailKind | null {
  return (
    SUBJECT_KINDS[
      String(subject || "")
        .trim()
        .toLowerCase()
    ] ?? null
  )
}

/** Graph returns HTML bodies; flatten to text the regexes can read. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
}

const ACCOUNT_RE = /\bACC-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/
const INVOICE_RE = /\bINV-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/
// Starlink writes US dates (M/D/YYYY): "1/11/2026 - 2/10/2026" is 11 Jan to 10 Feb.
const PERIOD_RE = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/
const AMOUNT_RE = /\b([A-Z]{3})\s*([\d,]+(?:\.\d{1,2})?)\b/

function usDateToISO(month: string, day: string, year: string): string | null {
  const m = Number(month)
  const d = Number(day)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function firstAmount(text: string, label: RegExp | null): { amount: number; currency: string } | null {
  const scope = label ? text.slice(Math.max(0, text.search(label))) : text
  if (label && text.search(label) < 0) return null
  const match = scope.match(AMOUNT_RE)
  if (!match) return null
  const amount = Number(match[2].replace(/,/g, ""))
  return Number.isFinite(amount) ? { amount, currency: match[1] } : null
}

/**
 * Pull the account, amount, invoice and period out of a billing email.
 * `attachmentNames` lets a reminder take its invoice number from the PDF name.
 */
export function parseStarlinkMail(
  kind: StarlinkMailKind,
  bodyText: string,
  attachmentNames: string[] = []
): ParsedStarlinkMail {
  const text = bodyText
  const accountNumber = text.match(ACCOUNT_RE)?.[0] ?? null

  let invoiceNumber = text.match(INVOICE_RE)?.[0] ?? null
  if (!invoiceNumber) {
    for (const name of attachmentNames) {
      const fromName = name.match(INVOICE_RE)?.[0]
      if (fromName) {
        invoiceNumber = fromName
        break
      }
    }
  }

  let periodStart: string | null = null
  let periodEnd: string | null = null
  const period = text.match(PERIOD_RE)
  if (period) {
    periodStart = usDateToISO(period[1], period[2], period[3])
    periodEnd = usDateToISO(period[4], period[5], period[6])
  }

  const amountLabel =
    kind === "processed" ? /\bAmount\b/ : kind === "failed" ? /Payment Amount/ : /Statement Period|Current Balance/
  // A reminder's amount follows its period on the same line, so skip past the dates.
  const amountSource = kind === "reminder" && period ? text.slice(text.indexOf(period[0]) + period[0].length) : text
  const money = firstAmount(amountSource, kind === "reminder" && period ? null : amountLabel)

  return {
    kind,
    accountNumber,
    amount: money?.amount ?? null,
    currency: money?.currency ?? null,
    invoiceNumber,
    periodStart,
    periodEnd,
  }
}

/** The ISO date one calendar month after `iso`, clamped to the month's last day. */
export function addOneMonthISO(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const nextMonthIndex = m // 0-based index of the following month
  const year = y + Math.floor(nextMonthIndex / 12)
  const month = (nextMonthIndex % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`
}
