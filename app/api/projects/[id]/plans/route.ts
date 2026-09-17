import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { apiError, ApiErrorCode } from "@/lib/api/errors"

export const dynamic = "force-dynamic"
const log = logger("project-plans-api")

const PlanSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required"),
  description: z.string().trim().max(5000).optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
})

const UpdatePlanSchema = PlanSchema.partial().extend({
  plan_id: z.string().uuid(),
})

const ReorderSchema = z.object({
  order: z.array(z.string().uuid()).min(1),
})

/**
 * Writes go through the service-role client (authenticated users hold only
 * SELECT on implementation_plans), which skips row-level security — so the
 * same rule the RLS write policy uses has to be checked here first, or any
 * signed-in user could change any project's plans.
 */
async function forbidUnlessManager(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const { data, error } = await (supabase as any).rpc("can_manage_project", { project_uuid: projectId })
  if (error) {
    log.error({ err: error.message }, "Failed to check project permission")
    return apiError("Failed to check permission", ApiErrorCode.DATABASE_ERROR, 500)
  }
  if (data !== true) {
    return apiError("You can't change this project's plans", ApiErrorCode.FORBIDDEN, 403)
  }
  return null
}

/**
 * Plans for a project.
 *
 * A plan is purely a folder for tasks — it has no weight and contributes
 * nothing to scoring on its own. Its tasks are ordinary rows in public.tasks
 * carrying plan_id, so they count once, in the assignee's KPI and in the
 * project's progress alike.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`project-plans:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const { data, error } = await supabase
    .from("implementation_plans")
    .select("*")
    .eq("project_id", params.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    log.error({ err: error.message }, "Failed to load plans")
    return apiError("Failed to load plans", ApiErrorCode.DATABASE_ERROR, 500)
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`project-plans-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)
  const forbidden = await forbidUnlessManager(supabase, params.id)
  if (forbidden) return forbidden
  const db = getServiceRoleClientOrFallback<any>(supabase as any)

  const parsed = PlanSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const { data, error } = await db
    .from("implementation_plans")
    .insert({
      project_id: params.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      sort_order: parsed.data.sort_order ?? 0,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    log.error({ err: error.message }, "Failed to create plan")
    return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 400)
  }

  return NextResponse.json({ data })
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)
  const forbidden = await forbidUnlessManager(supabase, params.id)
  if (forbidden) return forbidden
  const db = getServiceRoleClientOrFallback<any>(supabase as any)

  const parsed = UpdatePlanSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const { plan_id, ...changes } = parsed.data
  const { data, error } = await db
    .from("implementation_plans")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", plan_id)
    .eq("project_id", params.id)
    .select()
    .single()

  if (error) {
    log.error({ err: error.message }, "Failed to update plan")
    return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 400)
  }

  return NextResponse.json({ data })
}

/**
 * PATCH — save a new order for the project's plans. `order` must list every
 * plan on the project exactly once; each gets its position as sort_order.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`project-plans-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)
  const forbidden = await forbidUnlessManager(supabase, params.id)
  if (forbidden) return forbidden
  const db = getServiceRoleClientOrFallback<any>(supabase as any)

  const parsed = ReorderSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const { data: existing, error: loadError } = await db
    .from("implementation_plans")
    .select("id")
    .eq("project_id", params.id)
  if (loadError) {
    log.error({ err: loadError.message }, "Failed to load plans for reorder")
    return apiError("Failed to reorder plans", ApiErrorCode.DATABASE_ERROR, 500)
  }

  // A stale list (a plan added or removed meanwhile) must not half-apply.
  const order = parsed.data.order
  const existingIds = new Set(((existing || []) as { id: string }[]).map((plan) => plan.id))
  if (
    new Set(order).size !== order.length ||
    order.length !== existingIds.size ||
    order.some((id) => !existingIds.has(id))
  ) {
    return apiError("The plans changed while you were reordering. Refresh and try again.", ApiErrorCode.CONFLICT, 409)
  }

  const now = new Date().toISOString()
  const results = await Promise.all(
    order.map((planId, index) =>
      db
        .from("implementation_plans")
        .update({ sort_order: index, updated_at: now })
        .eq("id", planId)
        .eq("project_id", params.id)
    )
  )
  const failed = results.find((result: { error: { message: string } | null }) => result.error)
  if (failed) {
    log.error({ err: failed.error?.message }, "Failed to reorder plans")
    return apiError("Failed to reorder plans", ApiErrorCode.DATABASE_ERROR, 500)
  }

  return NextResponse.json({ data: { order } })
}

/**
 * Deleting a plan does not delete its tasks — plan_id is ON DELETE SET NULL,
 * so the work survives and simply becomes ungrouped. Losing a folder must
 * never quietly destroy scored work an employee has already been rated on.
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)
  const forbidden = await forbidUnlessManager(supabase, params.id)
  if (forbidden) return forbidden
  const db = getServiceRoleClientOrFallback<any>(supabase as any)

  const planId = new URL(request.url).searchParams.get("plan_id")
  if (!planId) return apiError("plan_id query param is required", ApiErrorCode.MISSING_REQUIRED_FIELD, 400)

  const { error } = await db.from("implementation_plans").delete().eq("id", planId).eq("project_id", params.id)

  if (error) {
    log.error({ err: error.message }, "Failed to delete plan")
    return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 400)
  }

  return NextResponse.json({ data: { id: planId } })
}
