/**
 * Problems a staff member reports about an asset assigned to them, from /accounts/assets.
 *
 * "faulty" is a fault with the asset itself: it becomes an asset_issues row and shows on the
 * existing Asset issues page. Every other kind is a problem with the record (who has it), stored in
 * asset_reports for an asset admin to resolve or reject. Client-safe: no server imports.
 */

export const ASSET_REPORT_KINDS = [
  "faulty",
  "not_received",
  "not_with_me",
  "already_returned",
  "wrong_details",
] as const
export type AssetReportKind = (typeof ASSET_REPORT_KINDS)[number]

/** The kinds stored in asset_reports (everything except a fault). */
export type AssetRecordReportKind = Exclude<AssetReportKind, "faulty">

export const ASSET_REPORT_KIND_LABELS: Record<AssetReportKind, { label: string; hint: string }> = {
  faulty: { label: "Faulty or damaged", hint: "It is broken, damaged or not working properly." },
  not_received: { label: "I didn't receive it", hint: "It was assigned to me, but I never got it." },
  not_with_me: { label: "It's not with me", hint: "I had it, but someone else has it now." },
  already_returned: { label: "I already returned it", hint: "I handed it back, but it still shows as mine." },
  wrong_details: { label: "Wrong details", hint: "The model, serial number or other details are wrong." },
}

/** Kinds that say the person does not have the asset, so resolving them can release it. */
export const CUSTODY_REPORT_KINDS: ReadonlySet<AssetReportKind> = new Set([
  "not_received",
  "not_with_me",
  "already_returned",
])

export type AssetReportStatus = "open" | "resolved" | "rejected"

export const ASSET_REPORT_STATUS_LABELS: Record<AssetReportStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  rejected: "Rejected",
}

/** A report as the admin reports API returns it. */
export interface AssetReport {
  id: string
  asset_id: string
  assignment_id: string | null
  kind: AssetRecordReportKind
  note: string | null
  status: AssetReportStatus
  resolution_note: string | null
  released: boolean
  created_at: string
  resolved_at: string | null
  reported_by: string
  reported_by_name: string
  resolved_by_name: string | null
  unique_code: string
  asset_type: string
  asset_model: string | null
  /** Whether the reporter still holds the asset (the report's assignment is current). */
  assignment_current: boolean
}
