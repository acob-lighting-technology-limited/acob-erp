/**
 * Organisation-wide configuration.
 *
 * Values are read from environment variables so they can be changed per-environment
 * (staging vs production) without a code deploy.
 *
 * Defaults match the current production setup. Override by setting the corresponding
 * env vars in .env.local or Vercel's project settings.
 *
 * ADDING A NEW SETTING
 * 1. Add the env var name + default below.
 * 2. Export a typed constant.
 * 3. Update .env.example with the new key and its default.
 */

// ---------------------------------------------------------------------------
// Company identity
// ---------------------------------------------------------------------------

/** Primary domain for company email addresses (e.g. "acoblighting.com") */
export const ORG_PRIMARY_DOMAIN = process.env.NEXT_PUBLIC_ORG_PRIMARY_DOMAIN ?? "acoblighting.com"

/** Secondary domain used for staff email accounts */
export const ORG_STAFF_DOMAIN = process.env.NEXT_PUBLIC_ORG_STAFF_DOMAIN ?? "org.acoblighting.com"

/** All accepted inbound email domains — used for validation */
export const ORG_EMAIL_DOMAINS: readonly string[] = [ORG_PRIMARY_DOMAIN, ORG_STAFF_DOMAIN]

/** Short company code prefix used in employee numbers and asset IDs */
export const ORG_CODE = process.env.NEXT_PUBLIC_ORG_CODE ?? "ACOB"

/** IT/ICT contact email shown in system emails */
export const ORG_ICT_EMAIL = process.env.NEXT_PUBLIC_ORG_ICT_EMAIL ?? `ict@${ORG_PRIMARY_DOMAIN}`

/** Sender display name + address used for all outbound notification emails */
export const ORG_NOTIFICATION_SENDER =
  process.env.ORG_NOTIFICATION_SENDER ?? `${ORG_CODE} Internal Systems <notifications@${ORG_PRIMARY_DOMAIN}>`

// ---------------------------------------------------------------------------
// Business hours (used for SLA calculations)
// ---------------------------------------------------------------------------

/** First business hour of the day (24-h, inclusive). Default 09:00. */
export const BUSINESS_HOUR_START = Number(process.env.BUSINESS_HOUR_START ?? 9)

/** Last business hour of the day (24-h, exclusive). Default 18:00. */
export const BUSINESS_HOUR_END = Number(process.env.BUSINESS_HOUR_END ?? 18)

// ---------------------------------------------------------------------------
// Help-desk SLA targets (in business-hours or business-days)
// ---------------------------------------------------------------------------

export interface SlaBudget {
  unit: "business_hours" | "business_days"
  value: number
}

export const HELP_DESK_SLA: Record<"urgent" | "high" | "medium" | "low", SlaBudget> = {
  urgent: {
    unit: "business_hours",
    value: Number(process.env.SLA_URGENT_HOURS ?? 4),
  },
  high: {
    unit: "business_hours",
    value: Number(process.env.SLA_HIGH_HOURS ?? 24),
  },
  medium: {
    unit: "business_days",
    value: Number(process.env.SLA_MEDIUM_DAYS ?? 3),
  },
  low: {
    unit: "business_days",
    value: Number(process.env.SLA_LOW_DAYS ?? 7),
  },
}
