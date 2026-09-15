import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getRequestScope } from "@/lib/admin/api-scope"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { apiError, ApiErrorCode } from "@/lib/api/errors"

export const dynamic = "force-dynamic"
const log = logger("portfolio-projects-api")

const MembershipSchema = z
  .object({
    add: z.array(z.string().uuid()).max(200).default([]),
    remove: z.array(z.string().uuid()).max(200).default([]),
  })
  .refine((body) => body.add.length + body.remove.length > 0, { message: "No projects to add or remove" })

/**
 * PATCH /api/portfolios/[id]/projects
 *
 * Moves projects into or out of a portfolio by setting `projects.portfolio_id`.
 * Adding a project that sits in another portfolio moves it here — a project has
 * one parent. Removing only detaches projects that are actually in this
 * portfolio, so a stale client cannot empty a different one.
 *
 * Admin-only. Project RLS would also let a project's own manager rewrite its
 * portfolio, so the admin gate lives here rather than relying on RLS.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`portfolio-write:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const scope = await getRequestScope()
  if (!scope) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)
  if (!scope.isAdminLike) return apiError("Forbidden", ApiErrorCode.FORBIDDEN, 403)

  const parsed = MembershipSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  const { add, remove } = parsed.data

  const supabase = await createClient()

  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", params.id)
    .maybeSingle()
  if (portfolioError) {
    log.error({ err: portfolioError.message }, "Failed to load portfolio")
    return apiError("Failed to load portfolio", ApiErrorCode.DATABASE_ERROR, 500)
  }
  if (!portfolio) return apiError("Portfolio not found", ApiErrorCode.NOT_FOUND, 404)

  const updatedAt = new Date().toISOString()
  let added = 0
  let removed = 0

  if (add.length > 0) {
    const { data, error } = await supabase
      .from("projects")
      .update({ portfolio_id: params.id, updated_at: updatedAt })
      .in("id", add)
      .select("id")
    if (error) {
      log.error({ err: error.message }, "Failed to add projects to portfolio")
      return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 400)
    }
    added = data?.length ?? 0
  }

  if (remove.length > 0) {
    const { data, error } = await supabase
      .from("projects")
      .update({ portfolio_id: null, updated_at: updatedAt })
      .in("id", remove)
      .eq("portfolio_id", params.id)
      .select("id")
    if (error) {
      log.error({ err: error.message }, "Failed to remove projects from portfolio")
      return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 400)
    }
    removed = data?.length ?? 0
  }

  return NextResponse.json({ data: { added, removed } })
}
