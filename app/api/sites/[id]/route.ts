import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode, serverError, validationError } from "@/lib/api/errors"
import { resolveSiteAccess } from "@/lib/sites/access"
import { loadSite, siteRow, syncSiteDocuments } from "@/lib/sites/records"
import { SiteFieldsSchema } from "@/lib/sites/schemas"

export const dynamic = "force-dynamic"
const log = logger("site-detail-api")

const SiteIdSchema = z.string().uuid()

/**
 * PATCH /api/sites/[id] — replace a site's details and documents with the
 * form's. The form always sends the whole site, so this is a full update.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!SiteIdSchema.safeParse(id).success) return apiError("Site not found", ApiErrorCode.NOT_FOUND, 404)

  const rl = await rateLimit(`sites-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)

  const access = await resolveSiteAccess({ requireEdit: true })
  if (!access.ok)
    return apiError(
      access.error,
      access.status === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.FORBIDDEN,
      access.status
    )
  const { dataClient, userId, supabase } = access

  const parsed = SiteFieldsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)

  let before
  try {
    before = await loadSite(dataClient, id)
  } catch (error) {
    return serverError(log, error, "Failed to load the site")
  }
  if (!before) return apiError("Site not found", ApiErrorCode.NOT_FOUND, 404)

  const row = siteRow(parsed.data)
  const { error } = await dataClient
    .from("sites")
    .update({ ...row, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) {
    if (error.code === "23505") {
      return apiError(
        "A site with this name is already registered in that LGA and state.",
        ApiErrorCode.ALREADY_EXISTS,
        409
      )
    }
    return serverError(log, error, "Failed to update the site")
  }

  try {
    await syncSiteDocuments(dataClient, id, parsed.data.documents, userId)
  } catch (docError) {
    return serverError(log, docError, "The site was updated, but its documents could not be saved")
  }

  await writeAuditLog(
    supabase,
    {
      action: "site.update",
      entityType: "site",
      entityId: id,
      oldValues: { ...siteRow({ ...before, documents: [] }), documents: before.documents.length },
      newValues: { ...row, documents: parsed.data.documents.length },
      context: { actorId: userId, source: "api", route: "/api/sites/[id]" },
    },
    { failOpen: true }
  )

  try {
    return NextResponse.json({ data: await loadSite(dataClient, id) })
  } catch (loadError) {
    return serverError(log, loadError, "The site was updated but could not be reloaded")
  }
}

/** DELETE /api/sites/[id] — remove a site and its documents. Admins only. */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!SiteIdSchema.safeParse(id).success) return apiError("Site not found", ApiErrorCode.NOT_FOUND, 404)

  const rl = await rateLimit(`sites-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)

  const access = await resolveSiteAccess({ requireEdit: true })
  if (!access.ok)
    return apiError(
      access.error,
      access.status === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.FORBIDDEN,
      access.status
    )
  const { dataClient, userId, supabase } = access

  let before
  try {
    before = await loadSite(dataClient, id)
  } catch (error) {
    return serverError(log, error, "Failed to load the site")
  }
  if (!before) return apiError("Site not found", ApiErrorCode.NOT_FOUND, 404)

  const { error } = await dataClient.from("sites").delete().eq("id", id)
  if (error) return serverError(log, error, "Failed to delete the site")

  await writeAuditLog(
    supabase,
    {
      action: "site.delete",
      entityType: "site",
      entityId: id,
      oldValues: { name: before.name, lga: before.lga, state: before.state, documents: before.documents },
      context: { actorId: userId, source: "api", route: "/api/sites/[id]" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ data: { id } })
}
