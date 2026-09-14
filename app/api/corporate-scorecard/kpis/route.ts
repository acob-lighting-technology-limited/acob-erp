import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"

const log = logger("corporate-scorecard-kpis")

type KpiAssignmentRow = {
  role: "core" | "support"
  corporate_kpis: {
    id: string
    source_sn: number
    perspective: string
    strategic_priority: string
    strategic_objective: string
    measure: string
    target_text: string
  } | null
}

/**
 * GET /api/corporate-scorecard/kpis?department=X
 *
 * The KPIs a department may tag a task to: everything it is CORE or SUPPORT
 * on, per the RACI grid, grouped by perspective/objective. Without a
 * department filter, every task-creation surface would offer all 61 KPIs —
 * unusable, and meaningless for a department that has no role on most of them.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`corporate-scorecard-kpis:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const department = request.nextUrl.searchParams.get("department")
  if (!department) {
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await supabase
    .from("kpi_assignments")
    .select(
      `role, corporate_kpis!inner (
        id, source_sn, perspective, strategic_priority, strategic_objective, measure, target_text
      )`
    )
    .eq("department", department)
    .eq("corporate_kpis.is_archived", false)
    .returns<KpiAssignmentRow[]>()

  if (error) {
    log.error({ err: error.message }, "Failed to load department KPIs")
    return apiError("Failed to load KPIs", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const rows = (data || [])
    .filter((row) => row.corporate_kpis)
    .map((row) => ({
      id: row.corporate_kpis!.id,
      perspective: row.corporate_kpis!.perspective,
      strategic_priority: row.corporate_kpis!.strategic_priority,
      strategic_objective: row.corporate_kpis!.strategic_objective,
      measure: row.corporate_kpis!.measure,
      target_text: row.corporate_kpis!.target_text,
      role: row.role,
    }))
    .sort((a, b) => {
      if (a.perspective !== b.perspective) return a.perspective.localeCompare(b.perspective)
      if (a.strategic_objective !== b.strategic_objective) {
        return a.strategic_objective.localeCompare(b.strategic_objective)
      }
      // CORE first within an objective, so the department's own targets lead.
      if (a.role !== b.role) return a.role === "core" ? -1 : 1
      return a.measure.localeCompare(b.measure)
    })

  return NextResponse.json({ data: rows })
}

const CreateKpiSchema = z.object({
  perspective: z.enum(["Financial", "Customer", "Internal Process", "Organizational Capacity"]),
  strategic_priority: z.string().trim().min(1, "Strategic Pillar is required").max(500),
  strategic_objective: z.string().trim().min(1, "Strategic Objective is required").max(500),
  measure: z.string().trim().min(1, "Measure / KPI name is required").max(500),
  target_text: z.string().trim().min(1, "Target text is required").max(1000),
  measure_type: z.enum(["count", "percentage", "currency", "milestone"]).default("count"),
  direction: z.enum(["at_least", "at_most"]).default("at_least"),
  core_departments: z.array(z.string().trim()).optional().default([]),
  support_departments: z.array(z.string().trim()).optional().default([]),
})

/**
 * POST /api/corporate-scorecard/kpis
 *
 * Creates a new Master Corporate KPI and optionally its initial RACI assignments.
 * Restricted to administrators.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`corporate-scorecard-kpi-create:${getClientId(request)}`, { limit: 30, windowSec: 60 })
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
    return apiError("Forbidden: Only administrators can create Corporate KPIs", ApiErrorCode.FORBIDDEN, 403)
  }

  const parsed = CreateKpiSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const db = getServiceRoleClientOrFallback(supabase)

  // Find next source_sn
  const { data: maxRow } = await db
    .from("corporate_kpis")
    .select("source_sn")
    .order("source_sn", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSn = ((maxRow as { source_sn?: number } | null)?.source_sn ?? 0) + 1

  const { data: newKpi, error: kpiError } = await db
    .from("corporate_kpis")
    .insert({
      source_sn: nextSn,
      perspective: parsed.data.perspective,
      strategic_priority: parsed.data.strategic_priority,
      strategic_objective: parsed.data.strategic_objective,
      measure: parsed.data.measure,
      target_text: parsed.data.target_text,
      measure_type: parsed.data.measure_type,
      direction: parsed.data.direction,
      is_archived: false,
    })
    .select()
    .single()

  if (kpiError || !newKpi) {
    log.error({ err: kpiError?.message }, "Failed to create corporate KPI")
    return apiError(kpiError?.message || "Failed to create Corporate KPI", ApiErrorCode.DATABASE_ERROR, 500)
  }

  // Insert initial assignments if provided
  const assignmentsToInsert: Array<{ kpi_id: string; department: string; role: "core" | "support" }> = []
  for (const dept of parsed.data.core_departments || []) {
    if (dept) assignmentsToInsert.push({ kpi_id: newKpi.id, department: dept, role: "core" })
  }
  for (const dept of parsed.data.support_departments || []) {
    if (dept && !parsed.data.core_departments?.includes(dept)) {
      assignmentsToInsert.push({ kpi_id: newKpi.id, department: dept, role: "support" })
    }
  }

  if (assignmentsToInsert.length > 0) {
    const { error: assignError } = await db.from("kpi_assignments").insert(assignmentsToInsert)
    if (assignError) {
      log.error({ err: assignError.message }, "Failed to insert initial assignments for corporate KPI")
    }
  }

  return NextResponse.json({ data: newKpi }, { status: 201 })
}
