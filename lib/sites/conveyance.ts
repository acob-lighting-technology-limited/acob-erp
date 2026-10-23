/**
 * Conveyance status for the Sites register.
 *
 * A site's paperwork is a set of documents (Exclusivity, MOU, NERC, NEMSA, …),
 * each obtained or still pending, most with an expiry date. Whether a document
 * has expired is derived here from its expiry date and today's date on every
 * read — never stored — so the register cannot go stale overnight.
 */

export const SITE_DOCUMENT_TYPES = ["exclusivity", "mou", "nerc", "nemsa", "other"] as const
export type SiteDocumentType = (typeof SITE_DOCUMENT_TYPES)[number]

export const SITE_DOCUMENT_TYPE_LABELS: Record<SiteDocumentType, string> = {
  exclusivity: "Exclusivity",
  mou: "MOU",
  nerc: "NERC",
  nemsa: "NEMSA",
  other: "Other",
}

export const SITE_DOCUMENT_STATUSES = ["pending", "obtained", "not_required"] as const
export type SiteDocumentStatus = (typeof SITE_DOCUMENT_STATUSES)[number]

export const SITE_DOCUMENT_STATUS_LABELS: Record<SiteDocumentStatus, string> = {
  pending: "Pending",
  obtained: "Obtained",
  not_required: "Not required",
}

/** A document this close to its expiry date is flagged before it lapses. */
export const EXPIRY_WARNING_DAYS = 60

/** One document's standing today. */
export type DocumentStanding = "valid" | "expiring" | "expired" | "pending" | "not_required"

/**
 * A site's overall standing — its worst document. "none" means nothing has
 * been recorded yet, which is different from "all clear".
 */
export type ConveyanceStanding = "expired" | "expiring" | "pending" | "valid" | "none"

export const CONVEYANCE_STANDING_LABELS: Record<ConveyanceStanding, string> = {
  expired: "Expired",
  expiring: "Expiring soon",
  pending: "Pending",
  valid: "Valid",
  none: "Not recorded",
}

export const DOCUMENT_STANDING_LABELS: Record<DocumentStanding, string> = {
  valid: "Valid",
  expiring: "Expiring soon",
  expired: "Expired",
  pending: "Pending",
  not_required: "Not required",
}

export type ConveyanceDocument = {
  document_type: SiteDocumentType
  label?: string | null
  status: SiteDocumentStatus
  expires_on?: string | null
}

/** Whole days from `fromIso` to `toIso` (both YYYY-MM-DD). Negative when `toIso` is earlier. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10))
  const to = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10))
  return Math.round((to - from) / 86_400_000)
}

/** A document's standing on `todayIso`. A document is valid through its expiry date. */
export function documentStanding(doc: ConveyanceDocument, todayIso: string): DocumentStanding {
  if (doc.status === "not_required") return "not_required"
  if (doc.status === "pending") return "pending"
  if (!doc.expires_on) return "valid"
  const daysLeft = daysBetween(todayIso, doc.expires_on.slice(0, 10))
  if (daysLeft < 0) return "expired"
  if (daysLeft <= EXPIRY_WARNING_DAYS) return "expiring"
  return "valid"
}

const STANDING_RANK: Record<DocumentStanding, number> = {
  expired: 0,
  expiring: 1,
  pending: 2,
  valid: 3,
  not_required: 4,
}

/** The site's overall standing: its worst document, ignoring ones marked not required. */
export function conveyanceStanding(docs: ConveyanceDocument[], todayIso: string): ConveyanceStanding {
  const relevant = docs.map((doc) => documentStanding(doc, todayIso)).filter((s) => s !== "not_required")
  if (relevant.length === 0) return "none"
  const worst = relevant.reduce((a, b) => (STANDING_RANK[b] < STANDING_RANK[a] ? b : a))
  return worst as ConveyanceStanding
}

/** The name a document is shown under: its type, or its own label for "other". */
export function documentName(doc: Pick<ConveyanceDocument, "document_type" | "label">): string {
  if (doc.document_type === "other") return doc.label?.trim() || "Other"
  return SITE_DOCUMENT_TYPE_LABELS[doc.document_type]
}
