import { NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import {
  beginControlledDocRequest,
  formDateOrNull,
  formFile,
  formString,
  loadControlledDoc,
} from "@/lib/documentation/controlled-api"
import {
  CONTROLLED_DOC_COLUMNS,
  buildControlledDocFolderPath,
  canManageDocument,
  canViewDocument,
  folderPathFromVersion,
  hydrateDocuments,
  notifyControlledDocAudience,
  uploadControlledDocFile,
  validateControlledDocFile,
  type ControlledDocDbRow,
} from "@/lib/documentation/controlled-server"

const log = logger("api-controlled-document-versions")

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/documentation/controlled/[id]/versions (multipart)
 *
 * Adds the next version and makes it current. Earlier versions are kept as
 * history. On a published policy this resets acknowledgement: everyone has to
 * confirm the new version, because acknowledgements are per version.
 */
export async function POST(request: Request, { params }: Params) {
  const begin = await beginControlledDocRequest(request, "version", 20)
  if (!begin.ok) return begin.response
  const { supabase, db, actor } = begin.ctx
  const { id } = await params

  const doc = await loadControlledDoc(db, id)
  if (!doc || !canViewDocument(actor, doc)) return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)
  if (!canManageDocument(actor, doc)) {
    return apiError("You don't have permission to manage this document", ApiErrorCode.FORBIDDEN, 403)
  }
  if (doc.status === "retired") {
    return apiError("Publish the document again before adding a version", ApiErrorCode.INVALID_STATE, 409)
  }

  const formData = await request.formData()
  const file = formFile(formData, "file")
  const effectiveDate = formDateOrNull(formData, "effective_date")
  const changeSummary = formString(formData, "change_summary")

  const fileError = validateControlledDocFile(file)
  if (fileError || !file) return apiError(fileError || "A file is required", ApiErrorCode.VALIDATION_ERROR, 400)
  if (!effectiveDate) return apiError("Effective date is required", ApiErrorCode.VALIDATION_ERROR, 400)
  if (!changeSummary) return apiError("Describe what changed in this version", ApiErrorCode.VALIDATION_ERROR, 400)

  const { data: latest } = await db
    .from("controlled_document_versions")
    .select("version_number, file_path")
    .eq("document_id", doc.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number; file_path: string }>()

  const versionNumber = (latest?.version_number ?? 0) + 1
  const folderPath = latest
    ? folderPathFromVersion(latest)
    : buildControlledDocFolderPath(doc.doc_type, doc.reference_code, doc.title)

  let uploaded: { filePath: string; fileName: string }
  try {
    uploaded = await uploadControlledDocFile({ folderPath, versionNumber, file })
  } catch (err) {
    log.error({ err: String(err) }, "SharePoint upload failed")
    return apiError("Could not upload the file to SharePoint. Please try again.", ApiErrorCode.INTERNAL_ERROR, 502)
  }

  const versionId = crypto.randomUUID()
  const { error: versionError } = await db.from("controlled_document_versions").insert({
    id: versionId,
    document_id: doc.id,
    version_number: versionNumber,
    effective_date: effectiveDate,
    change_summary: changeSummary,
    file_name: uploaded.fileName,
    file_path: uploaded.filePath,
    mime_type: file.type || null,
    file_size: file.size,
    uploaded_by: actor.userId,
  })

  if (versionError) {
    // 23505: someone added the same version number a moment earlier.
    const conflict = versionError.code === "23505"
    log.error({ err: versionError.message }, "Failed to record version")
    return apiError(
      conflict ? "Another version was just added. Refresh and try again." : "Failed to save the new version",
      conflict ? ApiErrorCode.CONFLICT : ApiErrorCode.DATABASE_ERROR,
      conflict ? 409 : 500
    )
  }

  const { data, error } = await db
    .from("controlled_documents")
    .update({ current_version_id: versionId, updated_by: actor.userId })
    .eq("id", doc.id)
    .select(CONTROLLED_DOC_COLUMNS)
    .single()

  if (error || !data) {
    log.error({ err: error?.message }, "Failed to set current version")
    return apiError("Version saved, but it could not be made current", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const updated = data as ControlledDocDbRow

  await writeAuditLog(
    supabase,
    {
      action: "update",
      entityType: "controlled_document",
      entityId: doc.id,
      newValues: { version_id: versionId, version_number: versionNumber, file_path: uploaded.filePath },
      metadata: { event: "new_version", change_summary: changeSummary },
      context: { source: "api", route: `/api/documentation/controlled/${doc.id}/versions`, actorId: actor.userId },
    },
    { failOpen: true }
  )

  if (updated.status === "published") {
    await notifyControlledDocAudience(db, updated, { event: "revised", versionNumber, actorId: actor.userId })
  }

  const [row] = await hydrateDocuments(db, actor, [updated])
  return NextResponse.json({ data: row }, { status: 201 })
}
