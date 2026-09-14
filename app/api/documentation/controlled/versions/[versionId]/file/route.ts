import { NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { logger } from "@/lib/logger"
import { getOneDriveService } from "@/lib/onedrive"
import { beginControlledDocRequest, loadControlledDoc } from "@/lib/documentation/controlled-api"
import {
  CONTROLLED_VERSION_COLUMNS,
  canManageDocument,
  canViewDocument,
  type ControlledDocVersionDbRow,
} from "@/lib/documentation/controlled-server"

const log = logger("api-controlled-document-file")

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ versionId: string }> }

/**
 * GET — streams a version's file from SharePoint. Staff may only open the
 * current version of a document they can see; managers may open any version.
 * `?disposition=inline` opens PDFs in the browser, `attachment` downloads.
 */
export async function GET(request: Request, { params }: Params) {
  const begin = await beginControlledDocRequest(request, "file", 60)
  if (!begin.ok) return begin.response
  const { db, actor } = begin.ctx
  const { versionId } = await params

  const { data } = await db
    .from("controlled_document_versions")
    .select(CONTROLLED_VERSION_COLUMNS)
    .eq("id", versionId)
    .maybeSingle()
  const version = data as ControlledDocVersionDbRow | null
  if (!version) return apiError("File not found", ApiErrorCode.NOT_FOUND, 404)

  const doc = await loadControlledDoc(db, version.document_id)
  if (!doc || !canViewDocument(actor, doc)) return apiError("File not found", ApiErrorCode.NOT_FOUND, 404)
  if (doc.current_version_id !== version.id && !canManageDocument(actor, doc)) {
    return apiError("This version has been superseded", ApiErrorCode.FORBIDDEN, 403)
  }

  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) {
    return apiError("SharePoint integration is not configured", ApiErrorCode.INTERNAL_ERROR, 500)
  }

  try {
    const downloadUrl = await onedrive.getDownloadUrl(version.file_path)
    const upstream = await fetch(downloadUrl)
    if (!upstream.ok) {
      return apiError("Failed to fetch the file from SharePoint", ApiErrorCode.INTERNAL_ERROR, 502)
    }

    const disposition = new URL(request.url).searchParams.get("disposition") === "attachment" ? "attachment" : "inline"
    const safeName = version.file_name.replace(/["\r\n\\]/g, "")

    return new NextResponse(Buffer.from(await upstream.arrayBuffer()), {
      headers: {
        "Content-Type": version.mime_type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err) {
    log.error({ err: String(err) }, "Failed to stream controlled document file")
    return apiError("Failed to fetch the file from SharePoint", ApiErrorCode.INTERNAL_ERROR, 502)
  }
}
