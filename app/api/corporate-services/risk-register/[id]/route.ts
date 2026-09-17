import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRequestScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { OWNER_EDITABLE_FIELDS, RISK_COLUMNS, UpdateRiskSchema, type RiskRow } from "@/lib/risk-register/model"
import { leadsDepartment, notifyControlOwner } from "@/lib/risk-register/server"

const log = logger("corporate-services:risk-register:item")

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const parsed = UpdateRiskSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: existingData, error: loadError } = await supabase
      .from("risk_register")
      .select(RISK_COLUMNS)
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      log.error({ err: loadError.message, id }, "Failed to load risk item")
      return NextResponse.json({ error: "Failed to load the risk" }, { status: 500 })
    }
    if (!existingData) return NextResponse.json({ error: "Risk not found" }, { status: 404 })
    const existing = existingData as RiskRow

    const leadsIt = leadsDepartment(scope, existing.department)
    const canEditAll = scope.isAdminLike || leadsIt
    const isOwner = existing.control_owner_id === scope.userId
    if (!canEditAll && !isOwner) {
      return NextResponse.json({ error: "You cannot edit this risk" }, { status: 403 })
    }

    const updates = parsed.data
    if (!canEditAll) {
      const allowed = new Set<string>(OWNER_EDITABLE_FIELDS)
      const blocked = Object.keys(updates).filter((key) => !allowed.has(key))
      if (blocked.length > 0) {
        return NextResponse.json(
          { error: "As control owner you can update the mitigation, timeline and status only" },
          { status: 403 }
        )
      }
    }
    // A lead moving a risk to a department they do not lead would lose it.
    if (!scope.isAdminLike && updates.department && !leadsDepartment(scope, updates.department)) {
      return NextResponse.json({ error: "You can only move a risk to a department you lead" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("risk_register")
      .update(updates)
      .eq("id", id)
      .select(RISK_COLUMNS)
      .single()

    if (error || !data) {
      log.error({ err: error?.message, id }, "Failed to update risk item")
      return NextResponse.json({ error: "Failed to save the risk" }, { status: 500 })
    }

    const risk = data as RiskRow
    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "risk_register",
        entityId: id,
        oldValues: { ...existing },
        newValues: updates,
        context: { actorId: scope.userId, source: "api", route: "/api/corporate-services/risk-register/[id]" },
      },
      { failOpen: true }
    )
    if (risk.control_owner_id !== existing.control_owner_id) {
      await notifyControlOwner(supabase, risk, scope.userId)
    }

    return NextResponse.json({ data: risk })
  } catch (err: unknown) {
    log.error({ err: String(err) }, "Failed to patch risk register item")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getRequestScope()
    if (!scope || !scope.isAdminLike) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("risk_register")
      .delete()
      .eq("id", id)
      .select("id, risk_name")
      .maybeSingle()

    if (error) {
      log.error({ err: error.message, id }, "Failed to delete risk item")
      return NextResponse.json({ error: "Failed to delete the risk" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Risk not found" }, { status: 404 })

    await writeAuditLog(
      supabase,
      {
        action: "delete",
        entityType: "risk_register",
        entityId: id,
        oldValues: data,
        context: { actorId: scope.userId, source: "api", route: "/api/corporate-services/risk-register/[id]" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    log.error({ err: String(err) }, "Failed to delete risk item")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
