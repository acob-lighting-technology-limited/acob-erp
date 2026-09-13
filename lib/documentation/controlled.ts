/**
 * Controlled documents — company policies and standard operating procedures.
 *
 * Client-safe: types, labels, and pure helpers only. Server-side access rules
 * and queries live in `controlled-server.ts`.
 */

export type ControlledDocType = "policy" | "sop"
export type ControlledDocStatus = "draft" | "published" | "retired"

export const CONTROLLED_DOC_TYPES: readonly ControlledDocType[] = ["policy", "sop"]

export const CONTROLLED_DOC_META: Record<
  ControlledDocType,
  {
    label: string
    plural: string
    shortPlural: string
    codePrefix: string
    sharePointFolder: string
    route: string
    /** Staff must confirm reading each published version. */
    requiresAcknowledgement: boolean
  }
> = {
  policy: {
    label: "Policy",
    plural: "Company Policies",
    shortPlural: "Policies",
    codePrefix: "POL",
    sharePointFolder: "Company Policies",
    route: "policies",
    requiresAcknowledgement: true,
  },
  sop: {
    label: "SOP",
    plural: "Standard Operating Procedures",
    shortPlural: "SOPs",
    codePrefix: "SOP",
    sharePointFolder: "Standard Operating Procedures",
    route: "sops",
    requiresAcknowledgement: false,
  },
}

export const CONTROLLED_DOC_STATUS_LABELS: Record<ControlledDocStatus, string> = {
  draft: "Draft",
  published: "Published",
  retired: "Retired",
}

/** SharePoint library (site "department-documents") that holds every version file. */
export const CONTROLLED_DOC_LIBRARY = "Documents"

/**
 * Uploads pass through a Vercel function, whose request body is capped at
 * 4.5 MB. Keep the file comfortably under that so the form data fits.
 */
export const CONTROLLED_DOC_MAX_FILE_BYTES = 4 * 1024 * 1024

export const CONTROLLED_DOC_ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"] as const

export const CONTROLLED_DOC_ACCEPT = CONTROLLED_DOC_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")

/** Days before `next_review_date` at which a document counts as "review due soon". */
export const REVIEW_DUE_SOON_DAYS = 30

export interface ControlledDocVersion {
  id: string
  document_id: string
  version_number: number
  effective_date: string
  change_summary: string | null
  file_name: string
  mime_type: string | null
  file_size: number | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
}

export interface ControlledDocRow {
  id: string
  doc_type: ControlledDocType
  reference_code: string
  title: string
  description: string | null
  category: string | null
  owner_department: string | null
  is_company_wide: boolean
  departments: string[]
  status: ControlledDocStatus
  next_review_date: string | null
  published_at: string | null
  retired_at: string | null
  created_at: string
  updated_at: string
  current_version: ControlledDocVersion | null
  /** Caller's acknowledgement of the current version (policies only). */
  my_acknowledged_at: string | null
  /** Caller may edit, version, publish, or retire this document. */
  can_manage: boolean
  /** Present on manage views for policies: progress on the current version. */
  acknowledgement?: { acknowledged: number; total: number } | null
}

export interface ControlledDocListResponse {
  data: ControlledDocRow[]
  permissions: { canCreate: boolean; manageableDepartments: string[] | null }
}

export interface ControlledDocDetailResponse {
  data: ControlledDocRow
  versions: ControlledDocVersion[]
}

export interface AcknowledgementStaffRow {
  user_id: string
  name: string
  department: string | null
  acknowledged_at: string | null
}

export function parseControlledDocType(value: string | null | undefined): ControlledDocType | null {
  return value === "policy" || value === "sop" ? value : null
}

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".")
  return index > 0 ? fileName.slice(index + 1).toLowerCase() : ""
}

export function isAllowedControlledDocFile(fileName: string): boolean {
  return (CONTROLLED_DOC_ALLOWED_EXTENSIONS as readonly string[]).includes(getFileExtension(fileName))
}

export function formatReferenceCode(type: ControlledDocType, sequence: number): string {
  return `${CONTROLLED_DOC_META[type].codePrefix}-${String(sequence).padStart(3, "0")}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type ReviewState = "none" | "ok" | "due_soon" | "overdue"

export function getReviewState(nextReviewDate: string | null, today = new Date()): ReviewState {
  if (!nextReviewDate) return "none"
  const due = new Date(`${nextReviewDate}T00:00:00`)
  if (Number.isNaN(due.getTime())) return "none"
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((due.getTime() - startOfToday.getTime()) / 86_400_000)
  if (days < 0) return "overdue"
  if (days <= REVIEW_DUE_SOON_DAYS) return "due_soon"
  return "ok"
}

export function describeAudience(doc: Pick<ControlledDocRow, "doc_type" | "is_company_wide" | "departments">): string {
  if (doc.doc_type === "policy" || doc.is_company_wide) return "Company-wide"
  return doc.departments.join(", ")
}

/** Staff surface route for a document type, e.g. `/documentation/policies`. */
export function controlledDocLibraryHref(type: ControlledDocType, documentId?: string): string {
  const base = `/documentation/${CONTROLLED_DOC_META[type].route}`
  return documentId ? `${base}?doc=${documentId}` : base
}

export function controlledDocFileHref(versionId: string, disposition: "inline" | "attachment" = "inline"): string {
  return `/api/documentation/controlled/versions/${versionId}/file?disposition=${disposition}`
}

export function formatDocDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}
