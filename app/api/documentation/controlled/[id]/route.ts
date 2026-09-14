import { NextResponse } from "next/server"
import { z } from "zod"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getOneDriveService } from "@/lib/onedrive"
import { normalizeDepartmentName } from "@/shared/departments"
import { beginControlledDocRequest, loadControlledDoc } from "@/lib/documentation/controlled-api"
import {
  CONTROLLED_DOC_COLUMNS,
  CONTROLLED_VERSION_COLUMNS,
  canManageDocument,
  canViewDocument,
  folderPathFromVersion,
  hydrateDocuments,
  loadUploaderNames,
  notifyControlledDocAudience,
  toVersion,
  validateSopAudience,
  type ControlledDocDbRow,
  type ControlledDocVersionDbRow,
} from "@/lib/documentation/controlled-server"
import type { ControlledDocDetailResponse } from "@/lib/documentation/controlled"

const log = logger("api-controlled-document")

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .nullable()

const PatchSchema = z
  .object({
    action: z.enum(["publish", "retire"]).optional(),
    title: z.string().trim().min(1, "Title is required").max(300).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
    next_review_date: dateString.optional(),
    owner_department: z.string().trim().max(120).nullable().optional(),
    is_company_wide: z.boolean().optional(),
    departments: z.array(z.string().trim().min(1)).max(30).optional(),
  })
  .strict()

/** GET — one document. Managers also receive the full version history. */
export async function GET(request: Request, { params }: Params) {
  const begin = await beginControlledDocRequest(request, "detail")
  if (!begin.ok) return begin.response
  const { db, actor } = begin.ctx
  const { id } = await params

  const doc = await loadControlledDoc(db, id)
  if (!doc || !canViewDocument(actor, doc)) {
    return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)
  }

  const [row] = await hydrateDocuments(db, actor, [doc])

  // Superseded versions stay with the people who control the document, so
  // staff can only ever open the version currently in force.
  let versions = row.current_version ? [row.current_version] : []
  if (canManageDocument(actor, doc)) {
    const { data } = await db
      .from("controlled_document_versions")
      .select(CONTROLLED_VERSION_COLUMNS)
      .eq("document_id", doc.id)
      .order("version_number", { ascending: false })
    const versionRows = (data || []) as ControlledDocVersionDbRow[]
    const names = await loadUploaderNames(
      db,
      versionRows.map((v) => v.uploaded_by || "")
    )
    versions = versionRows.map((v) => toVersion(v, names))
  }

  const response: ControlledDocDetailResponse = { data: row, versions }
  return NextResponse.json(response)
}

/** PATCH — edit metadata, or publish / retire. */
export async function PATCH(request: Request, { params }: Params) {
  const begin = await beginControlledDocRequest(request, "update", 30)
  if (!begin.ok) return begin.response
  const { supabase, db, actor } = begin.ctx
  const { id } = await params

  const doc = await loadControlledDoc(db, id)
  if (!doc || !canViewDocument(actor, doc)) return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)
  if (!canManageDocument(actor, doc)) {
    return apiError("You don't have permission to manage this document", ApiErrorCode.FORBIDDEN, 403)
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid request", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  const input = parsed.data
  const updates: Record<string, unknown> = { updated_by: actor.userId }

  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description || null
  if (input.category !== undefined) updates.category = input.category || null
  if (input.next_review_date !== undefined) updates.next_review_date = input.next_review_date

  if (doc.doc_type === "sop") {
    const touchesAudience =
      input.owner_department !== undefined || input.is_company_wide !== undefined || input.departments !== undefined
    if (touchesAudience) {
      const ownerDepartment =
        input.owner_department !== undefined
          ? input.owner_department
            ? normalizeDepartmentName(input.owner_department)
            : null
          : doc.owner_department
      const isCompanyWide = input.is_company_wide ?? doc.is_company_wide
      const departments = isCompanyWide
        ? []
        : (input.departments ?? doc.departments ?? []).map((dept) => normalizeDepartmentName(dept))
      const audienceError = validateSopAudience(actor, {
        owner_department: ownerDepartment,
        is_company_wide: isCompanyWide,
        departments,
      })
      if (audienceError) return apiError(audienceError, ApiErrorCode.VALIDATION_ERROR, 400)
      updates.owner_department = ownerDepartment
      updates.is_company_wide = isCompanyWide
      updates.departments = departments
    }
  } else if (input.owner_department !== undefined) {
    updates.owner_department = input.owner_department ? normalizeDepartmentName(input.owner_department) : null
  }

  const now = new Date().toISOString()
  const firstPublish = input.action === "publish" && doc.status === "draft"

  if (input.action === "publish") {
    if (doc.status === "published") return apiError("Already published", ApiErrorCode.INVALID_STATE, 409)
    if (!doc.current_version_id) {
      return apiError("Upload a file before publishing", ApiErrorCode.INVALID_STATE, 409)
    }
    updates.status = "published"
    updates.published_at = now
    updates.retired_at = null
  } else if (input.action === "retire") {
    if (doc.status === "retired") return apiError("Already retired", ApiErrorCode.INVALID_STATE, 409)
    updates.status = "retired"
    updates.retired_at = now
  }

  const { data, error } = await db
    .from("controlled_documents")
    .update(updates)
    .eq("id", doc.id)
    .select(CONTROLLED_DOC_COLUMNS)
    .single()

  if (error || !data) {
    log.error({ err: error?.message }, "Failed to update controlled document")
    return apiError("Failed to update document", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const updated = data as ControlledDocDbRow

  await writeAuditLog(
    supabase,
    {
      action: input.action ? "status_change" : "update",
      entityType: "controlled_document",
      entityId: doc.id,
      oldValues: doc as unknown as Record<string, unknown>,
      newValues: updated as unknown as Record<string, unknown>,
      metadata: input.action ? { action: input.action } : undefined,
      context: { source: "api", route: `/api/documentation/controlled/${doc.id}`, actorId: actor.userId },
    },
    { failOpen: true }
  )

  if (firstPublish && updated.current_version_id) {
    const { data: version } = await db
      .from("controlled_document_versions")
      .select("version_number")
      .eq("id", updated.current_version_id)
      .maybeSingle<{ version_number: number }>()
    await notifyControlledDocAudience(db, updated, {
      event: "published",
      versionNumber: version?.version_number ?? 1,
      actorId: actor.userId,
    })
  }

  const [row] = await hydrateDocuments(db, actor, [updated])
  return NextResponse.json({ data: row })
}

/**
 * DELETE — only a draft that was never published. Anything staff may have
 * read is retired instead, so the record of what was in force survives.
 */
export async function DELETE(request: Request, { params }: Params) {
  const begin = await beginControlledDocRequest(request, "delete", 20)
  if (!begin.ok) return begin.response
  const { supabase, db, actor } = begin.ctx
  const { id } = await params

  const doc = await loadControlledDoc(db, id)
  if (!doc || !canViewDocument(actor, doc)) return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)
  if (!canManageDocument(actor, doc)) {
    return apiError("You don't have permission to manage this document", ApiErrorCode.FORBIDDEN, 403)
  }
  if (doc.status !== "draft" || doc.published_at) {
    return apiError("Published documents can't be deleted — retire them instead", ApiErrorCode.INVALID_STATE, 409)
  }

  const { data: versions } = await db
    .from("controlled_document_versions")
    .select("file_path")
    .eq("document_id", doc.id)
    .limit(1)

  const { error } = await db.from("controlled_documents").delete().eq("id", doc.id)
  if (error) {
    log.error({ err: error.message }, "Failed to delete draft")
    return apiError("Failed to delete document", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const firstVersion = ((versions || []) as Array<{ file_path: string }>)[0]
  if (firstVersion) {
    try {
      await getOneDriveService().deleteItem(folderPathFromVersion(firstVersion))
    } catch (err) {
      // The record is gone either way; an orphaned draft folder is harmless.
      log.warn({ err: String(err) }, "Failed to remove draft folder from SharePoint")
    }
  }

  await writeAuditLog(
    supabase,
    {
      action: "delete",
      entityType: "controlled_document",
      entityId: doc.id,
      oldValues: doc as unknown as Record<string, unknown>,
      context: { source: "api", route: `/api/documentation/controlled/${doc.id}`, actorId: actor.userId },
    },
    { failOpen: true }
  )

  return NextResponse.json({ success: true })
}
