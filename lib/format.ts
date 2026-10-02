/**
 * The one place UI code formats values for display.
 *
 * Dates and times are always rendered in WAT (Africa/Lagos) with a fixed locale,
 * so every viewer sees "25 May 2026" regardless of their browser's locale — not
 * "5/25/2026" for one person and "25/05/2026" for another. Money is Naira.
 *
 * Import from here instead of writing a local formatDate/formatCurrency/getInitials
 * in a component (AGENTS.md → Engineering Practices → Reuse before you write).
 */
import { formatWATDate, formatWATDateTime, formatWATRelative, formatWATTime } from "@/lib/utils/date"

type DateInput = string | Date | null | undefined

function isValidDate(value: DateInput): value is string | Date {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime())
}

/** "25 May 2026" — or `fallback` for empty/invalid input. */
export function formatDate(value: DateInput, fallback = "—"): string {
  return isValidDate(value) ? formatWATDate(value) : fallback
}

/** "25 May 2026, 09:30 am" */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  return isValidDate(value) ? formatWATDateTime(value) : fallback
}

/** "09:30 AM" */
export function formatTime(value: DateInput, fallback = "—"): string {
  return isValidDate(value) ? formatWATTime(value) : fallback
}

/** "9:30 AM" today, "Yesterday", or "25 May". */
export function formatRelative(value: DateInput, fallback = "—"): string {
  return isValidDate(value) ? formatWATRelative(value) : fallback
}

/** "Mon, 25 May" — compact weekday + day for calendars and meeting lists. */
export function formatShortDay(value: DateInput, fallback = "—"): string {
  return isValidDate(value)
    ? formatWATDate(value, { weekday: "short", day: "numeric", month: "short", year: undefined })
    : fallback
}

const nairaFormatter = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 })
const nairaWholeFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
})
const compactFormatter = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 })
const numberFormatter = new Intl.NumberFormat("en-NG")

/**
 * "₦1,250,000.00". `whole: true` drops the kobo; `compact: true` gives "₦1.3M".
 * Other ISO currencies are supported for multi-currency finance records.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencyOrOptions: string | { currency?: string; whole?: boolean; compact?: boolean; fallback?: string } = {}
): string {
  const options = typeof currencyOrOptions === "string" ? { currency: currencyOrOptions } : currencyOrOptions
  const value = typeof amount === "string" ? Number(amount) : amount
  if (value == null || Number.isNaN(value)) return options.fallback ?? "—"
  const currency = (options.currency || "NGN").toUpperCase()
  if (options.compact) {
    const symbol = currency === "NGN" ? "₦" : `${currency} `
    return `${value < 0 ? "-" : ""}${symbol}${compactFormatter.format(Math.abs(value))}`
  }
  if (currency === "NGN") return (options.whole ? nairaWholeFormatter : nairaFormatter).format(value)
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: options.whole ? 0 : 2,
  }).format(value)
}

/** "1,250" */
export function formatNumber(value: number | null | undefined, fallback = "—"): string {
  return value == null || Number.isNaN(value) ? fallback : numberFormatter.format(value)
}

/** 0.873 → "87%" (ratio input) or 87.3 → "87%" with `{ ratio: false }`. */
export function formatPercent(
  value: number | null | undefined,
  options: { ratio?: boolean; decimals?: number; fallback?: string } = {}
): string {
  if (value == null || Number.isNaN(value)) return options.fallback ?? "—"
  const pct = options.ratio === false ? value : value * 100
  return `${pct.toFixed(options.decimals ?? 0)}%`
}

/** Display name from a profile-like object: "Ada Obi", falling back to email, then "Unknown". */
export function personName(
  person:
    | {
        full_name?: string | null
        first_name?: string | null
        last_name?: string | null
        company_email?: string | null
      }
    | null
    | undefined,
  fallback = "Unknown"
): string {
  if (!person) return fallback
  const full = person.full_name?.trim()
  if (full) return full
  const joined = [person.first_name, person.last_name].filter(Boolean).join(" ").trim()
  if (joined) return joined
  return person.company_email?.split("@")[0] || fallback
}

/** "AO" from "Ada Obi"; falls back to the first two letters of an email. */
export function initials(
  person:
    | {
        full_name?: string | null
        first_name?: string | null
        last_name?: string | null
        company_email?: string | null
      }
    | null
    | undefined
): string {
  const name = personName(person, "")
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)
    return letters.toUpperCase()
  }
  return "?"
}

/** "in_progress" → "In progress" */
export function humanize(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback
  const text = value.replace(/[_-]+/g, " ").trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
