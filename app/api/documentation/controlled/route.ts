import { NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { isSameDepartment, normalizeDepartmentName } from "@/shared/departments"
import {
  beginControlledDocRequest,
  formDateOrNull,
  formFile,
  formString,
  formStringList,
} from "@/lib/documentation/controlled-api"
import {
  CONTROLLED_DOC_COLUMNS,
  buildControlledDocFolderPath,
  canViewDocument,
  hydrateDocuments,
  nextReferenceCode,
  notifyControlledDocAudience,
  uploadControlledDocFile,
  validateControlledDocFile,
  validateSopAudience,
  type ControlledDocDbRow,
} from "@/lib/documentation/controlled-server"
import {
  CONTROLLED_DOC_META,
  parseControlledDocType,
  type ControlledDocListResponse,
} from "@/lib/documentation/controlled"

const log = logger("api-controlled-documents")

export const dynamic = "force-dynamic"

function overlaps(values: string[], scope: string[]): boolean {
  return values.some((value) => scope.some((dept) => isSameDepartment(value, dept)))
}

/**
 * GET /api/documentation/controlled?type=policy|sop&view=library|manage
 *
 * library — what the caller may read: published documents addressed to them.
 * manage  — the admin / department console register. Scoped by the request's
 *           admin scope (a department console only ever sees its department),
 *           includes drafts the caller can manage, and acknowledgement progress.
 */
export async function GET(request: Request) {
  const begin = await beginControlledDocRequest(request, "list")
  if (!begin.ok) return begin.response
  const { db, actor } = begin.ctx

  const url = new URL(request.url)
  const type = parseControlledDocType(url.searchParams.get("type"))
  if (!type) return apiError("type must be policy or sop", ApiErrorCode.VALIDATION_ERROR, 400)
  const view = url.searchParams.get("view") === "manage" ? "manage" : "library"

  const { data, error } = await db
    .from("controlled_documents")
    .select(CONTROLLED_DOC_COLUMNS)
    .eq("doc_type", type)
    .order("reference_code", { ascending: true })

  if (error) {
    log.error({ err: error.message }, "Failed to load controlled documents")
    return apiError("Failed to load documents", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const docs = (data || []) as ControlledDocDbRow[]

  if (view === "library") {
    const visible = docs.filter((doc) => doc.status === "published" && canViewDocument(actor, doc))
    const response: ControlledDocListResponse = {
      data: await hydrateDocuments(db, actor, visible),
      permissions: { canCreate: false, manageableDepartments: [] },
    }
    return NextResponse.json(response)
  }

  const scope = await getRequestScope()
  if (!scope) return apiError("Forbidden", ApiErrorCode.FORBIDDEN, 403)
  const scopedDepartments = getScopedDepartments(scope)

  const visible = docs.filter((doc) => {
    if (!canViewDocument(actor, doc)) return false
    if (scopedDepartments === null || doc.doc_type === "policy") return true
    if (doc.owner_department && overlaps([doc.owner_department], scopedDepartments)) return true
    return doc.status === "published" && (doc.is_company_wide || overlaps(doc.departments || [], scopedDepartments))
  })

  const scopeNames = scopedDepartments === null ? null : scope.managedDepartments.map(normalizeDepartmentName)
  const manageableDepartments =
    type === "policy"
      ? null
      : scopeNames === null
        ? actor.isAdmin
          ? null
          : actor.ledDepartments
        : actor.isAdmin
          ? scopeNames
          : actor.ledDepartments.filter((dept) => overlaps([dept], scopeNames))

  const canCreate =
    type === "policy"
      ? actor.canManagePolicies
      : actor.isAdmin || (manageableDepartments !== null && manageableDepartments.length > 0)

  const response: ControlledDocListResponse = {
    data: await hydrateDocuments(db, actor, visible, { acknowledgementScope: scopeNames }),
    permissions: { canCreate, manageableDepartments },
  }
  return NextResponse.json(response)
}

/**
 * POST /api/documentation/controlled (multipart)
 *
 * Creates a document with its first version. `publish=true` publishes it
 * immediately and notifies the audience; otherwise it is saved as a draft.
 */
export async function POST(request: Request) {
  const begin = await beginControlledDocRequest(request, "create", 20)
  if (!begin.ok) return begin.response
  const { supabase, db, actor } = begin.ctx

  const formData = await request.formData()
  const type = parseControlledDocType(formString(formData, "type"))
  if (!type) return apiError("type must be policy or sop", ApiErrorCode.VALIDATION_ERROR, 400)

  const title = formString(formData, "title")
  const effectiveDate = formDateOrNull(formData, "effective_date")
  const file = formFile(formData, "file")
  const publish = formString(formData, "publish") === "true"

  if (!title || title.length > 300) {
    return apiError("Title is required (max 300 characters)", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  if (!effectiveDate) return apiError("Effective date is required", ApiErrorCode.VALIDATION_ERROR, 400)
  const fileError = validateControlledDocFile(file)
  if (fileError || !file) return apiError(fileError || "A file is required", ApiErrorCode.VALIDATION_ERROR, 400)

  const ownerDepartmentRaw = formString(formData, "owner_department")
  const ownerDepartment = ownerDepartmentRaw ? normalizeDepartmentName(ownerDepartmentRaw) : null
  const isCompanyWide = type === "policy" ? true : formString(formData, "is_company_wide") !== "false"
  const departments = isCompanyWide ? [] : formStringList(formData, "departments").map(normalizeDepartmentName)

  if (type === "policy") {
    if (!actor.canManagePolicies) {
      return apiError("Only administrators and Admin and HR leads can manage policies", ApiErrorCode.FORBIDDEN, 403)
    }
  } else {
    const audienceError = validateSopAudience(actor, {
      owner_department: ownerDepartment,
      is_company_wide: isCompanyWide,
      departments,
    })
    if (audienceError) {
      const status = audienceError.startsWith("You can only") ? 403 : 400
      return apiError(audienceError, status === 403 ? ApiErrorCode.FORBIDDEN : ApiErrorCode.VALIDATION_ERROR, status)
    }
  }

  const documentId = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const now = new Date().toISOString()

  let referenceCode = await nextReferenceCode(db, type)
  let inserted: ControlledDocDbRow | null = null

  // Two creators can compute the same next code; the unique constraint catches
  // it and one retry with a fresh code resolves the race.
  for (let attempt = 0; attempt < 2 && !inserted; attempt += 1) {
    const { data, error } = await db
      .from("controlled_documents")
      .insert({
        id: documentId,
        doc_type: type,
        reference_code: referenceCode,
        title,
        description: formString(formData, "description") || null,
        category: formString(formData, "category") || null,
        owner_department: ownerDepartment,
        is_company_wide: isCompanyWide,
        departments,
        status: "draft",
        next_review_date: formDateOrNull(formData, "next_review_date"),
        created_by: actor.userId,
        updated_by: actor.userId,
      })
      .select(CONTROLLED_DOC_COLUMNS)
      .single()

    if (!error) {
      inserted = data as ControlledDocDbRow
    } else if (error.code === "23505" && attempt === 0) {
      referenceCode = await nextReferenceCode(db, type)
    } else {
      log.error({ err: error.message }, "Failed to create controlled document")
      return apiError("Failed to create document", ApiErrorCode.DATABASE_ERROR, 500)
    }
  }

  if (!inserted) return apiError("Failed to create document", ApiErrorCode.DATABASE_ERROR, 500)

  let uploaded: { filePath: string; fileName: string }
  try {
    uploaded = await uploadControlledDocFile({
      folderPath: buildControlledDocFolderPath(type, referenceCode, title),
      versionNumber: 1,
      file,
    })
  } catch (err) {
    log.error({ err: String(err) }, "SharePoint upload failed")
    await db.from("controlled_documents").delete().eq("id", documentId)
    return apiError("Could not upload the file to SharePoint. Please try again.", ApiErrorCode.INTERNAL_ERROR, 502)
  }

  const { error: versionError } = await db.from("controlled_document_versions").insert({
    id: versionId,
    document_id: documentId,
    version_number: 1,
    effective_date: effectiveDate,
    change_summary: formString(formData, "change_summary") || "Initial version",
    file_name: uploaded.fileName,
    file_path: uploaded.filePath,
    mime_type: file.type || null,
    file_size: file.size,
    uploaded_by: actor.userId,
  })

  if (versionError) {
    log.error({ err: versionError.message }, "Failed to record first version")
    await db.from("controlled_documents").delete().eq("id", documentId)
    return apiError("Failed to save the document version", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const { data: updated, error: updateError } = await db
    .from("controlled_documents")
    .update({
      current_version_id: versionId,
      ...(publish ? { status: "published", published_at: now } : {}),
    })
    .eq("id", documentId)
    .select(CONTROLLED_DOC_COLUMNS)
    .single()

  if (updateError || !updated) {
    log.error({ err: updateError?.message }, "Failed to finalize controlled document")
    return apiError("Document saved, but it could not be finalized", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const doc = updated as ControlledDocDbRow

  await writeAuditLog(
    supabase,
    {
      action: "create",
      entityType: "controlled_document",
      entityId: documentId,
      newValues: { ...doc, version_number: 1, file_path: uploaded.filePath },
      context: { source: "api", route: "/api/documentation/controlled", actorId: actor.userId },
    },
    { failOpen: true }
  )

  if (publish) {
    await notifyControlledDocAudience(db, doc, { event: "published", versionNumber: 1, actorId: actor.userId })
  }

  const [row] = await hydrateDocuments(db, actor, [doc])
  return NextResponse.json(
    {
      data: row,
      message: `${CONTROLLED_DOC_META[type].label} ${referenceCode} ${publish ? "published" : "saved as draft"}`,
    },
    { status: 201 }
  )
}
