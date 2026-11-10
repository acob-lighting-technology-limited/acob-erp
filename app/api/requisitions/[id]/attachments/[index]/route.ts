import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { attachmentContentType, canShowInline } from "@/lib/requisitions/attachment-types"
import { canViewRequisition, getViewerContext, loadRequisition, withSignedUrls } from "@/lib/requisitions/server"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

const log = logger("api-requisition-attachment")

const ParamsSchema = z.object({
  id: z.string().uuid(),
  index: z.coerce.number().int().min(0).max(99),
})

/**
 * GET /api/requisitions/[id]/attachments/[index]  (?download=1 to save instead of view)
 *
 * Serves a supporting document from our own origin, so the page can show it in
 * place (storage and SharePoint links are download links) and the PDF export can
 * read it. Whoever may see the requisition may see its documents.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; index: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin } = auth

  const rl = await rateLimit(`requisition-attachment:${user.id || getClientId(request)}`, { limit: 120, windowSec: 60 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const parsed = ParamsSchema.safeParse(await params)
  if (!parsed.success) return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)
  const { id, index } = parsed.data
  const download = request.nextUrl.searchParams.get("download") === "1"

  try {
    const [req, viewer] = await Promise.all([loadRequisition(admin, id), getViewerContext(admin, user.id)])
    // Same answer for "missing" and "not yours", so ids cannot be probed.
    if (!req || !canViewRequisition(req, viewer)) return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)

    const file = (await withSignedUrls(admin, req)).attachments?.[index]
    if (!file?.signed_url) return apiError("Document not found", ApiErrorCode.NOT_FOUND, 404)

    const upstream = await fetch(file.signed_url, { signal: AbortSignal.timeout(30_000), cache: "no-store" })
    if (!upstream.ok || !upstream.body) {
      log.warn({ status: upstream.status, requisitionId: id, index }, "Attachment source did not return the file")
      return apiError("Could not load this document", ApiErrorCode.INTERNAL_ERROR, 502)
    }

    const contentType = attachmentContentType(file.file_name, file.file_type)
    const inline = !download && canShowInline(contentType)
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    })
    const length = upstream.headers.get("content-length")
    if (length) headers.set("Content-Length", length)
    // An uploaded file is never trusted to run anything on our origin. (A PDF is left unsandboxed
    // because the browser's viewer will not open one that is.)
    if (contentType !== "application/pdf") headers.set("Content-Security-Policy", "sandbox; default-src 'none'")

    return new NextResponse(upstream.body, { status: 200, headers })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load this document")
  }
}
