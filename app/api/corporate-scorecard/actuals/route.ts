import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"

const log = logger("corporate-scorecard-actuals")

const CreateActualSchema = z
  .object({
    kpi_id: z.string().uuid(),
    department: z.string().trim().min(1),
    review_cycle_id: z.string().uuid().optional().nullable(),
    actual_value: z.number().optional().nullable(),
    milestones_completed: z.number().int().min(0).optional().nullable(),
    milestones_total: z.number().int().min(0).optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
    is_override: z.boolean().optional().default(true),
  })
  .refine((body) => body.actual_value != null || body.milestones_completed != null, {
    message: "Provide either an actual value or a milestone count",
  })

/**
 * POST /api/corporate-scorecard/actuals
 *
 * Records a new progress actual (or managerial override) for a KPI.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`corporate-scorecard-actuals-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const parsed = CreateActualSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const { data, error } = await supabase
    .from("kpi_actuals")
    .insert({
      kpi_id: parsed.data.kpi_id,
      department: parsed.data.department,
      review_cycle_id: parsed.data.review_cycle_id || null,
      actual_value: parsed.data.actual_value ?? null,
      milestones_completed: parsed.data.milestones_completed ?? null,
      milestones_total: parsed.data.milestones_total ?? null,
      note: parsed.data.note || null,
      is_override: parsed.data.is_override ?? true,
      recorded_by: user.id,
    })
    .select()
    .single()

  if (error) {
    log.error({ err: error.message }, "Failed to record KPI actual")
    return apiError(
      error.code === "42501" || error.code === "PGRST116"
        ? "You can only record actuals for your own department"
        : error.message || "Failed to record actual",
      ApiErrorCode.DATABASE_ERROR,
      error.code === "42501" || error.code === "PGRST116" ? 403 : 500
    )
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/corporate-scorecard/actuals?kpi_id=...&department=...
 *
 * Removes manual overrides for a KPI so that it reverts to live auto-derivation.
 */
export async function DELETE(request: NextRequest) {
  const rl = await rateLimit(`corporate-scorecard-actuals-delete:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const { searchParams } = new URL(request.url)
  const kpiId = searchParams.get("kpi_id")
  const department = searchParams.get("department")

  if (!kpiId || !department) {
    return apiError("KPI ID and department are required", ApiErrorCode.MISSING_REQUIRED_FIELD, 400)
  }

  const { error } = await supabase.from("kpi_actuals").delete().eq("kpi_id", kpiId).eq("department", department)

  if (error) {
    log.error({ err: error.message, kpiId, department }, "Failed to clear manual override")
    return apiError(error.message || "Failed to clear manual override", ApiErrorCode.DATABASE_ERROR, 500)
  }

  return NextResponse.json({ success: true, message: "Manual override cleared; reverted to live auto-derivation" })
}
