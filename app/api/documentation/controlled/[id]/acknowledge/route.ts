import { NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { beginControlledDocRequest, loadControlledDoc } from "@/lib/documentation/controlled-api"
import { canViewDocument } from "@/lib/documentation/controlled-server"

const log = logger("api-controlled-document-acknowledge")

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * POST — the caller confirms they have read and understood the policy's
 * current version. Idempotent: acknowledging twice keeps the first timestamp.
 */
export async function POST(request: Request, { params }: Params) {
  const begin = await beginControlledDocRequest(request, "acknowledge", 30)
  if (!begin.ok) return begin.response
  const { supabase, db, actor } = begin.ctx
  const { id } = await params

  const doc = await loadControlledDoc(db, id)
  if (!doc || !canViewDocument(actor, doc)) return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)
  if (doc.doc_type !== "policy" || doc.status !== "published" || !doc.current_version_id) {
    return apiError("Only published policies can be acknowledged", ApiErrorCode.INVALID_STATE, 409)
  }

  const body = (await request.json().catch(() => null)) as { version_id?: unknown } | null
  // The client names the version it showed. If the policy changed in the
  // meantime, refuse rather than record agreement to text the user never saw.
  if (body?.version_id && body.version_id !== doc.current_version_id) {
    return apiError(
      "This policy was just updated. Please reopen it and read the new version.",
      ApiErrorCode.CONFLICT,
      409
    )
  }

  const { data: existing } = await db
    .from("controlled_document_acknowledgements")
    .select("acknowledged_at")
    .eq("version_id", doc.current_version_id)
    .eq("user_id", actor.userId)
    .maybeSingle<{ acknowledged_at: string }>()

  if (existing) {
    return NextResponse.json({ data: { acknowledged_at: existing.acknowledged_at } })
  }

  const { data, error } = await db
    .from("controlled_document_acknowledgements")
    .insert({ document_id: doc.id, version_id: doc.current_version_id, user_id: actor.userId })
    .select("acknowledged_at")
    .single<{ acknowledged_at: string }>()

  if (error || !data) {
    log.error({ err: error?.message }, "Failed to record acknowledgement")
    return apiError("Failed to record your acknowledgement", ApiErrorCode.DATABASE_ERROR, 500)
  }

  await writeAuditLog(
    supabase,
    {
      action: "approve",
      entityType: "controlled_document",
      entityId: doc.id,
      newValues: { version_id: doc.current_version_id, acknowledged_at: data.acknowledged_at },
      metadata: { event: "acknowledged" },
      context: {
        source: "api",
        route: `/api/documentation/controlled/${doc.id}/acknowledge`,
        actorId: actor.userId,
      },
    },
    { failOpen: true }
  )

  return NextResponse.json({ data: { acknowledged_at: data.acknowledged_at } }, { status: 201 })
}
