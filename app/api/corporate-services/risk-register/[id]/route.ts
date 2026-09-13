import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getRequestScope } from "@/lib/admin/api-scope"
import { logger } from "@/lib/logger"

const log = logger("corporate-services:risk-register:item")

const UpdateRiskSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  description: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  category: z
    .enum(["operational", "financial", "strategic", "compliance", "technical", "reputational", "health_safety"])
    .optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  mitigation_plan: z.string().optional().nullable(),
  contingency_plan: z.string().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  status: z.enum(["open", "mitigating", "resolved", "closed"]).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await getRequestScope()
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const json = await request.json()
    const parsed = UpdateRiskSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("risk_register")
      .update(parsed.data)
      .eq("id", id)
      .select(
        `
        id,
        title,
        description,
        department,
        week_number,
        year,
        category,
        severity,
        likelihood,
        impact,
        risk_score,
        mitigation_plan,
        contingency_plan,
        owner_id,
        status,
        report_id,
        created_at,
        updated_at,
        profiles:owner_id (
          id,
          first_name,
          last_name,
          email
        )
      `
      )
      .single()

    if (error) {
      log.error({ err: error.message, id }, "Failed to update risk item")
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    log.error({ err: msg }, "Failed to patch risk register item")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await getRequestScope()
    if (!scope || !scope.isAdminLike) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { error } = await supabase.from("risk_register").delete().eq("id", id)

    if (error) {
      log.error({ err: error.message, id }, "Failed to delete risk item")
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    log.error({ err: msg }, "Failed to delete risk item")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
