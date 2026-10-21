import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode, serverError, validationError } from "@/lib/api/errors"
import { resolveSiteAccess } from "@/lib/sites/access"
import { loadSite, loadSites, siteRow, syncSiteDocuments } from "@/lib/sites/records"
import { SiteFieldsSchema } from "@/lib/sites/schemas"

export const dynamic = "force-dynamic"
const log = logger("sites-api")

/**
 * GET /api/sites — the Sites register with each site's documents.
 * `?portfolio_id=` narrows it to one portfolio. Readable by all staff.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`sites:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)

  const access = await resolveSiteAccess({ requireEdit: false })
  if (!access.ok)
    return apiError(
      access.error,
      access.status === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.FORBIDDEN,
      access.status
    )

  const portfolioParam = request.nextUrl.searchParams.get("portfolio_id")
  const portfolioId = portfolioParam && z.string().uuid().safeParse(portfolioParam).success ? portfolioParam : null
  if (portfolioParam && !portfolioId) {
    return apiError("Invalid portfolio", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  try {
    const data = await loadSites(access.dataClient, { portfolioId })
    return NextResponse.json({ data, canEdit: access.canEdit })
  } catch (error) {
    return serverError(log, error, "Failed to load sites")
  }
}

/** POST /api/sites — add a site and its documents. Admins only. */
export async function POST(request: NextRequest) {
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

  const { data: created, error } = await dataClient
    .from("sites")
    .insert({ ...siteRow(parsed.data), created_by: userId, updated_by: userId })
    .select("id")
    .single()
  if (error || !created) {
    if (error?.code === "23505") {
      return apiError(
        "A site with this name is already registered in that LGA and state.",
        ApiErrorCode.ALREADY_EXISTS,
        409
      )
    }
    return serverError(log, error, "Failed to add the site")
  }

  try {
    await syncSiteDocuments(dataClient, created.id, parsed.data.documents, userId)
  } catch (docError) {
    // Undo the create so a failed save leaves nothing behind — otherwise a
    // retry with the same name hits the unique index (409) while the first
    // attempt sits in the register without its paperwork. Documents cascade.
    log.error({ err: String(docError), siteId: created.id }, "Site documents failed to save; removing the new site")
    const { error: rollbackError } = await dataClient.from("sites").delete().eq("id", created.id)
    if (rollbackError) {
      log.error({ err: rollbackError.message, siteId: created.id }, "Failed to remove site after document failure")
      return apiError(
        "The site was added, but its documents could not be saved. Open it and add them again.",
        ApiErrorCode.DATABASE_ERROR,
        500
      )
    }
    return apiError("The site could not be saved. Please try again.", ApiErrorCode.DATABASE_ERROR, 500)
  }

  await writeAuditLog(
    supabase,
    {
      action: "site.create",
      entityType: "site",
      entityId: created.id,
      newValues: { ...siteRow(parsed.data), documents: parsed.data.documents.length },
      context: { actorId: userId, source: "api", route: "/api/sites" },
    },
    { failOpen: true }
  )

  try {
    return NextResponse.json({ data: await loadSite(dataClient, created.id) }, { status: 201 })
  } catch (loadError) {
    return serverError(log, loadError, "The site was added but could not be reloaded")
  }
}
