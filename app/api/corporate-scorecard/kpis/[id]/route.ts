import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"

const log = logger("corporate-scorecard-kpi-id")

const UpdateKpiSchema = z.object({
  perspective: z.enum(["Financial", "Customer", "Internal Process", "Organizational Capacity"]).optional(),
  strategic_priority: z.string().trim().min(1, "Strategic Pillar cannot be empty").max(500).optional(),
  strategic_objective: z.string().trim().min(1, "Strategic Objective cannot be empty").max(500).optional(),
  measure: z.string().trim().min(1, "Measure / KPI name cannot be empty").max(500).optional(),
  target_text: z.string().trim().min(1, "Target text cannot be empty").max(1000).optional(),
  measure_type: z.enum(["count", "percentage", "currency", "milestone"]).optional(),
  direction: z.enum(["at_least", "at_most"]).optional(),
  is_archived: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/corporate-scorecard/kpis/[id]
 *
 * Update an existing corporate KPI. Restricted to administrators.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  if (!id) return apiError("KPI ID is required", ApiErrorCode.MISSING_REQUIRED_FIELD, 400)

  const rl = await rateLimit(`corporate-scorecard-kpi-update:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope?.isAdminLike) {
    return apiError("Forbidden: Only administrators can modify Corporate KPIs", ApiErrorCode.FORBIDDEN, 403)
  }

  const parsed = UpdateKpiSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const db = getServiceRoleClientOrFallback(supabase)

  const updatePayload = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db.from("corporate_kpis").update(updatePayload).eq("id", id).select().single()

  if (error || !data) {
    log.error({ err: error?.message, id }, "Failed to update corporate KPI")
    return apiError(error?.message || "Failed to update Corporate KPI", ApiErrorCode.DATABASE_ERROR, 500)
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/corporate-scorecard/kpis/[id]
 *
 * Soft-archives a corporate KPI to preserve task and progress historical integrity.
 * Restricted to administrators.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  if (!id) return apiError("KPI ID is required", ApiErrorCode.MISSING_REQUIRED_FIELD, 400)

  const rl = await rateLimit(`corporate-scorecard-kpi-delete:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope?.isAdminLike) {
    return apiError("Forbidden: Only administrators can archive Corporate KPIs", ApiErrorCode.FORBIDDEN, 403)
  }

  const db = getServiceRoleClientOrFallback(supabase)

  const { error } = await db
    .from("corporate_kpis")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    log.error({ err: error.message, id }, "Failed to archive corporate KPI")
    return apiError(error.message || "Failed to archive Corporate KPI", ApiErrorCode.DATABASE_ERROR, 500)
  }

  return NextResponse.json({ success: true })
}
