import type { SupabaseClient } from "@supabase/supabase-js"
import { getOneDriveService } from "@/lib/onedrive"
import { expandDepartmentScopeForQuery, isAdminLikeRole } from "@/lib/admin/rbac"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"
import { DEPT_ADMIN_HR, isSameDepartment, normalizeDepartmentName } from "@/shared/departments"
import { getParentFolderPath, sanitizeSegment, sanitizeSharePointFileName } from "@/lib/documentation/sharepoint"
import {
  CONTROLLED_DOC_LIBRARY,
  CONTROLLED_DOC_MAX_FILE_BYTES,
  CONTROLLED_DOC_META,
  controlledDocLibraryHref,
  formatReferenceCode,
  isAllowedControlledDocFile,
  type AcknowledgementStaffRow,
  type ControlledDocRow,
  type ControlledDocStatus,
  type ControlledDocType,
  type ControlledDocVersion,
} from "@/lib/documentation/controlled"

const log = logger("controlled-documents")

// ─── Row shapes (not in generated types) ─────────────────────────────────────

export interface ControlledDocDbRow {
  id: string
  doc_type: ControlledDocType
  reference_code: string
  title: string
  description: string | null
  category: string | null
  owner_department: string | null
  is_company_wide: boolean
  departments: string[] | null
  status: ControlledDocStatus
  next_review_date: string | null
  current_version_id: string | null
  published_at: string | null
  retired_at: string | null
  created_at: string
  updated_at: string
}

export interface ControlledDocVersionDbRow {
  id: string
  document_id: string
  version_number: number
  effective_date: string
  change_summary: string | null
  file_name: string
  file_path: string
  mime_type: string | null
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

type ActorProfileRow = {
  role: string | null
  department: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
}

type StaffProfileRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
  employment_status: string | null
}

export const CONTROLLED_DOC_COLUMNS =
  "id, doc_type, reference_code, title, description, category, owner_department, is_company_wide, departments, status, next_review_date, current_version_id, published_at, retired_at, created_at, updated_at"

export const CONTROLLED_VERSION_COLUMNS =
  "id, document_id, version_number, effective_date, change_summary, file_name, file_path, mime_type, file_size, uploaded_by, created_at"

// ─── Actor & permissions ─────────────────────────────────────────────────────

export interface ControlledDocActor {
  userId: string
  isAdmin: boolean
  department: string | null
  ledDepartments: string[]
  /** Admins, plus the Admin and HR lead, own the policy register. */
  canManagePolicies: boolean
}

export async function resolveControlledDocActor(
  db: SupabaseClient,
  userId: string
): Promise<ControlledDocActor | null> {
  const { data: profile } = await db
    .from("profiles")
    .select("role, department, is_department_lead, lead_departments")
    .eq("id", userId)
    .maybeSingle<ActorProfileRow>()

  if (!profile) return null

  const isAdmin = isAdminLikeRole(profile.role)
  const department = profile.department ? normalizeDepartmentName(profile.department) : null
  const leadList = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  const ledDepartments = profile.is_department_lead
    ? Array.from(new Set((leadList.length > 0 ? leadList : [department]).filter(Boolean).map(normalizeDepartmentName)))
    : []

  return {
    userId,
    isAdmin,
    department,
    ledDepartments,
    canManagePolicies: isAdmin || ledDepartments.some((dept) => isSameDepartment(dept, DEPT_ADMIN_HR)),
  }
}

function leadsDepartment(actor: ControlledDocActor, department: string | null | undefined): boolean {
  if (!department) return false
  return actor.ledDepartments.some((dept) => isSameDepartment(dept, department))
}

export function canManageDocument(
  actor: ControlledDocActor,
  doc: Pick<ControlledDocDbRow, "doc_type" | "owner_department">
): boolean {
  if (doc.doc_type === "policy") return actor.canManagePolicies
  return actor.isAdmin || leadsDepartment(actor, doc.owner_department)
}

function isInAudience(
  department: string | null,
  doc: Pick<ControlledDocDbRow, "doc_type" | "is_company_wide" | "departments">
): boolean {
  if (doc.doc_type === "policy" || doc.is_company_wide) return true
  return (doc.departments || []).some((dept) => isSameDepartment(dept, department))
}

export function canViewDocument(actor: ControlledDocActor, doc: ControlledDocDbRow): boolean {
  if (canManageDocument(actor, doc)) return true
  return doc.status === "published" && isInAudience(actor.department, doc)
}

/**
 * Validates who a SOP may be aimed at. Admins may target anything; a lead may
 * publish company-wide or to departments they lead, and must own it.
 */
export function validateSopAudience(
  actor: ControlledDocActor,
  input: { owner_department: string | null; is_company_wide: boolean; departments: string[] }
): string | null {
  if (!input.owner_department) return "Owner department is required for an SOP"
  if (!input.is_company_wide && input.departments.length === 0) {
    return "Select at least one department, or make the SOP company-wide"
  }
  if (actor.isAdmin) return null
  if (!leadsDepartment(actor, input.owner_department)) {
    return "You can only manage SOPs owned by a department you lead"
  }
  const outside = input.departments.filter((dept) => !leadsDepartment(actor, dept))
  if (outside.length > 0) {
    return `You can only target departments you lead (not ${outside.join(", ")})`
  }
  return null
}

// ─── File validation & SharePoint ────────────────────────────────────────────

export function validateControlledDocFile(file: File | null): string | null {
  if (!file || file.size === 0) return "A document file is required"
  if (!isAllowedControlledDocFile(file.name)) return "Upload a PDF, Word, Excel, or PowerPoint file"
  if (file.size > CONTROLLED_DOC_MAX_FILE_BYTES) {
    return `File is too large. The limit is ${Math.round(CONTROLLED_DOC_MAX_FILE_BYTES / (1024 * 1024))} MB — compress the PDF and try again`
  }
  return null
}

export function buildControlledDocFolderPath(type: ControlledDocType, referenceCode: string, title: string): string {
  const folder = sanitizeSegment(`${referenceCode} - ${title}`, referenceCode)
  return `/${CONTROLLED_DOC_LIBRARY}/${CONTROLLED_DOC_META[type].sharePointFolder}/${folder}`
}

/**
 * Uploads one version's file. New versions go next to the first version so a
 * document keeps a single SharePoint folder even if it is later retitled.
 */
export async function uploadControlledDocFile(params: {
  folderPath: string
  versionNumber: number
  file: File
}): Promise<{ filePath: string; fileName: string }> {
  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) {
    throw new Error("SharePoint integration is not configured")
  }

  const fileName = sanitizeSharePointFileName(params.file.name, "document")
  const filePath = `${params.folderPath}/v${params.versionNumber} - ${fileName}`

  await onedrive.createFolder(params.folderPath)
  await onedrive.uploadFile(filePath, await params.file.arrayBuffer(), params.file.type || "application/octet-stream")

  return { filePath, fileName }
}

export function folderPathFromVersion(version: Pick<ControlledDocVersionDbRow, "file_path">): string {
  return getParentFolderPath(version.file_path)
}

// ─── Reference codes ─────────────────────────────────────────────────────────

export async function nextReferenceCode(db: SupabaseClient, type: ControlledDocType): Promise<string> {
  const { data } = await db.from("controlled_documents").select("reference_code").eq("doc_type", type)
  const prefix = `${CONTROLLED_DOC_META[type].codePrefix}-`
  const highest = ((data || []) as Array<{ reference_code: string }>).reduce((max, row) => {
    if (!row.reference_code.startsWith(prefix)) return max
    const value = Number.parseInt(row.reference_code.slice(prefix.length), 10)
    return Number.isFinite(value) && value > max ? value : max
  }, 0)
  return formatReferenceCode(type, highest + 1)
}

// ─── Hydration ───────────────────────────────────────────────────────────────

function displayName(profile: Pick<StaffProfileRow, "full_name" | "first_name" | "last_name"> | undefined): string {
  if (!profile) return "Unknown"
  return profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Unknown"
}

export async function loadUploaderNames(db: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return new Map()
  const { data } = await db.from("profiles").select("id, full_name, first_name, last_name").in("id", ids)
  return new Map(((data || []) as StaffProfileRow[]).map((row) => [row.id, displayName(row)]))
}

export function toVersion(row: ControlledDocVersionDbRow, names: Map<string, string>): ControlledDocVersion {
  return {
    id: row.id,
    document_id: row.document_id,
    version_number: row.version_number,
    effective_date: row.effective_date,
    change_summary: row.change_summary,
    file_name: row.file_name,
    mime_type: row.mime_type,
    file_size: row.file_size,
    uploaded_by: row.uploaded_by,
    uploaded_by_name: row.uploaded_by ? names.get(row.uploaded_by) || null : null,
    created_at: row.created_at,
  }
}

/** Active staff in a department scope (`null` = everyone). */
export async function loadActiveStaff(db: SupabaseClient, departments: string[] | null): Promise<StaffProfileRow[]> {
  let query = db.from("profiles").select("id, full_name, first_name, last_name, department, employment_status")
  if (departments !== null) {
    const expanded = expandDepartmentScopeForQuery(departments)
    if (expanded.length === 0) return []
    query = query.in("department", expanded)
  }
  const { data, error } = await query
  if (error) {
    log.error({ err: error.message }, "Failed to load staff")
    return []
  }
  return ((data || []) as StaffProfileRow[]).filter((row) =>
    isAssignableEmploymentStatus(row.employment_status, { allowLegacyNullStatus: false })
  )
}

/** Active staff a document is addressed to. */
export async function loadAudienceStaff(
  db: SupabaseClient,
  doc: Pick<ControlledDocDbRow, "doc_type" | "is_company_wide" | "departments">
): Promise<StaffProfileRow[]> {
  const departments = doc.doc_type === "policy" || doc.is_company_wide ? null : doc.departments || []
  return loadActiveStaff(db, departments)
}

export async function hydrateDocuments(
  db: SupabaseClient,
  actor: ControlledDocActor,
  docs: ControlledDocDbRow[],
  options: { acknowledgementScope?: string[] | null | undefined } = {}
): Promise<ControlledDocRow[]> {
  const versionIds = docs.map((doc) => doc.current_version_id).filter((id): id is string => Boolean(id))

  const [versionsResult, myAcksResult] = await Promise.all([
    versionIds.length > 0
      ? db.from("controlled_document_versions").select(CONTROLLED_VERSION_COLUMNS).in("id", versionIds)
      : Promise.resolve({ data: [] as ControlledDocVersionDbRow[] }),
    versionIds.length > 0
      ? db
          .from("controlled_document_acknowledgements")
          .select("version_id, acknowledged_at")
          .eq("user_id", actor.userId)
          .in("version_id", versionIds)
      : Promise.resolve({ data: [] as Array<{ version_id: string; acknowledged_at: string }> }),
  ])

  const versionRows = (versionsResult.data || []) as ControlledDocVersionDbRow[]
  const names = await loadUploaderNames(
    db,
    versionRows.map((row) => row.uploaded_by || "")
  )
  const versionsById = new Map(versionRows.map((row) => [row.id, toVersion(row, names)]))
  const myAcks = new Map(
    ((myAcksResult.data || []) as Array<{ version_id: string; acknowledged_at: string }>).map((row) => [
      row.version_id,
      row.acknowledged_at,
    ])
  )

  // Acknowledgement progress, for manage views of published policies only.
  let ackProgress: Map<string, { acknowledged: number; total: number }> | null = null
  if (options.acknowledgementScope !== undefined) {
    const policyVersionIds = docs
      .filter((doc) => doc.doc_type === "policy" && doc.status === "published" && doc.current_version_id)
      .map((doc) => doc.current_version_id as string)

    if (policyVersionIds.length > 0) {
      const staff = await loadActiveStaff(db, options.acknowledgementScope)
      const staffIds = new Set(staff.map((row) => row.id))
      const { data: acks } = await db
        .from("controlled_document_acknowledgements")
        .select("version_id, user_id")
        .in("version_id", policyVersionIds)
      const counts = new Map<string, number>()
      for (const ack of (acks || []) as Array<{ version_id: string; user_id: string }>) {
        if (staffIds.has(ack.user_id)) counts.set(ack.version_id, (counts.get(ack.version_id) || 0) + 1)
      }
      ackProgress = new Map(
        policyVersionIds.map((versionId) => [
          versionId,
          { acknowledged: counts.get(versionId) || 0, total: staffIds.size },
        ])
      )
    }
  }

  return docs.map((doc) => ({
    id: doc.id,
    doc_type: doc.doc_type,
    reference_code: doc.reference_code,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    owner_department: doc.owner_department,
    is_company_wide: doc.is_company_wide,
    departments: doc.departments || [],
    status: doc.status,
    next_review_date: doc.next_review_date,
    published_at: doc.published_at,
    retired_at: doc.retired_at,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    current_version: doc.current_version_id ? versionsById.get(doc.current_version_id) || null : null,
    my_acknowledged_at: doc.current_version_id ? myAcks.get(doc.current_version_id) || null : null,
    can_manage: canManageDocument(actor, doc),
    acknowledgement:
      ackProgress && doc.current_version_id ? ackProgress.get(doc.current_version_id) || null : undefined,
  }))
}

export async function loadAcknowledgementStaff(
  db: SupabaseClient,
  doc: ControlledDocDbRow,
  departments: string[] | null
): Promise<AcknowledgementStaffRow[]> {
  if (!doc.current_version_id) return []
  const staff = await loadActiveStaff(db, departments)
  const { data: acks } = await db
    .from("controlled_document_acknowledgements")
    .select("user_id, acknowledged_at")
    .eq("version_id", doc.current_version_id)
  const ackByUser = new Map(
    ((acks || []) as Array<{ user_id: string; acknowledged_at: string }>).map((row) => [
      row.user_id,
      row.acknowledged_at,
    ])
  )
  return staff
    .map((row) => ({
      user_id: row.id,
      name: displayName(row),
      department: row.department,
      acknowledged_at: ackByUser.get(row.id) || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Notifications ───────────────────────────────────────────────────────────

/**
 * Tells the document's audience it was published or revised. Policies are
 * high priority because they need an acknowledgement; SOPs are informational.
 * Never throws — a notification failure must not undo the publish.
 */
export async function notifyControlledDocAudience(
  db: SupabaseClient,
  doc: ControlledDocDbRow,
  params: { event: "published" | "revised"; versionNumber: number; actorId: string }
): Promise<void> {
  try {
    const meta = CONTROLLED_DOC_META[doc.doc_type]
    const staff = await loadAudienceStaff(db, doc)
    const recipients = staff.map((row) => row.id).filter((id) => id !== params.actorId)
    if (recipients.length === 0) return

    const verb = params.event === "published" ? "Published" : "Updated"
    const title = `${meta.label} ${verb} — ${doc.title}`
    const message =
      doc.doc_type === "policy"
        ? `${doc.reference_code} v${params.versionNumber} is now in effect. Please read it and acknowledge.`
        : `${doc.reference_code} v${params.versionNumber} is now available.`

    const BATCH = 10
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map((userId) =>
          db.rpc("create_notification", {
            p_user_id: userId,
            p_type: "announcement",
            p_category: "system",
            p_title: title,
            p_message: message,
            p_priority: doc.doc_type === "policy" ? "high" : "normal",
            p_link_url: controlledDocLibraryHref(doc.doc_type, doc.id),
            p_actor_id: params.actorId,
            p_entity_type: "controlled_document",
            p_entity_id: doc.id,
          })
        )
      )
      for (const result of results) {
        if (result.status === "rejected") {
          log.error({ err: String(result.reason) }, "notification failed")
        } else if (result.value.error) {
          log.error({ err: result.value.error.message }, "notification failed")
        }
      }
    }
  } catch (err) {
    log.error({ err: String(err) }, "notifying controlled document audience failed")
  }
}
