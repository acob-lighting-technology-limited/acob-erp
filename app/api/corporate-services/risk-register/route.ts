import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRequestScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { CreateRiskSchema, RISK_COLUMNS, type RiskRow } from "@/lib/risk-register/model"
import {
  filterRisksToScope,
  involvedDepartments,
  leadsDepartment,
  notifyControlOwner,
} from "@/lib/risk-register/server"

const log = logger("corporate-services:risk-register")

export async function GET(request: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("risk_register")
      .select(RISK_COLUMNS)
      .order("department")
      .order("serial_no")

    if (error) {
      log.error({ err: error.message }, "Error fetching risk_register")
      return NextResponse.json({ error: "Failed to load the risk register" }, { status: 500 })
    }

    let scoped = filterRisksToScope((data || []) as RiskRow[], scope)
    const targetDept = request.nextUrl.searchParams.get("department")
    if (targetDept) {
      scoped = scoped.filter((r) => r.department === targetDept || involvedDepartments(r).includes(targetDept))
    }

    return NextResponse.json({ data: scoped })
  } catch (err: unknown) {
    log.error({ err: String(err) }, "Failed to fetch risk register")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = CreateRiskSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })
    }

    if (!scope.isAdminLike && !leadsDepartment(scope, parsed.data.department)) {
      return NextResponse.json({ error: "You can only raise risks for a department you lead" }, { status: 403 })
    }

    const supabase = await createClient()
    // serial_no is assigned by the database trigger; 0 satisfies NOT NULL until then.
    const { data, error } = await supabase
      .from("risk_register")
      .insert({ ...parsed.data, serial_no: 0 })
      .select(RISK_COLUMNS)
      .single()

    if (error || !data) {
      log.error({ err: error?.message }, "Failed to create risk register item")
      return NextResponse.json({ error: "Failed to save the risk" }, { status: 500 })
    }

    const risk = data as RiskRow
    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "risk_register",
        entityId: risk.id,
        newValues: parsed.data,
        context: { actorId: scope.userId, source: "api", route: "/api/corporate-services/risk-register" },
      },
      { failOpen: true }
    )
    await notifyControlOwner(supabase, risk, scope.userId)

    return NextResponse.json({ data: risk }, { status: 201 })
  } catch (err: unknown) {
    log.error({ err: String(err) }, "Failed to create risk register item")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
