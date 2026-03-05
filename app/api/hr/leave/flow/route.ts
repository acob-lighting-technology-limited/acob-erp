import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function canViewFlow(role?: string | null) {
  return ["developer", "super_admin", "admin"].includes(role || "")
}

function canEditFlow(role?: string | null) {
  return ["developer", "super_admin"].includes(role || "")
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!canViewFlow(profile?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const [rolesRes, routesRes, assignmentsRes, healthRes] = await Promise.all([
      supabase.from("leave_approver_roles").select("*").order("code"),
      supabase.from("leave_approval_role_routes").select("*").order("requester_kind").order("stage_order"),
      supabase
        .from("leave_approver_assignments")
        .select(
          "id, approver_role_code, user_id, scope_type, scope_value, effective_from, effective_to, is_active, is_primary"
        )
        .order("approver_role_code"),
      supabase.from("leave_routing_health_v").select("*").limit(1),
    ])

    if (rolesRes.error || routesRes.error || assignmentsRes.error || healthRes.error) {
      return NextResponse.json({ error: "Failed to load leave flow configuration" }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        roles: rolesRes.data || [],
        routes: routesRes.data || [],
        assignments: assignmentsRes.data || [],
        health: healthRes.data?.[0] || null,
      },
      permissions: {
        can_edit: canEditFlow(profile?.role),
      },
    })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/flow:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!canEditFlow(profile?.role)) {
      return NextResponse.json({ error: "Only super admin or developer can edit leave flow" }, { status: 403 })
    }

    const body = await request.json()
    const { roles, routes, assignments } = body || {}

    if (Array.isArray(roles) && roles.length) {
      const payload = roles.map((row: any) => ({
        code: String(row.code),
        name: String(row.name || row.code),
        description: row.description || null,
        resolution_mode: row.resolution_mode || "rule_based",
        resolution_config: row.resolution_config || {},
        is_active: row.is_active ?? true,
      }))
      const { error } = await supabase.from("leave_approver_roles").upsert(payload, { onConflict: "code" })
      if (error) return NextResponse.json({ error: "Failed to save approver roles" }, { status: 500 })
    }

    if (Array.isArray(routes) && routes.length) {
      const payload = routes.map((row: any) => ({
        requester_kind: String(row.requester_kind),
        stage_order: Number(row.stage_order),
        approver_role_code: String(row.approver_role_code),
        is_active: row.is_active ?? true,
      }))

      const { error } = await supabase.from("leave_approval_role_routes").upsert(payload, {
        onConflict: "requester_kind,stage_order",
      })
      if (error) return NextResponse.json({ error: "Failed to save route rows" }, { status: 500 })
    }

    if (Array.isArray(assignments) && assignments.length) {
      const payload = assignments.map((row: any) => ({
        approver_role_code: String(row.approver_role_code),
        user_id: String(row.user_id),
        scope_type: row.scope_type || "global",
        scope_value: row.scope_value || null,
        effective_from: row.effective_from || null,
        effective_to: row.effective_to || null,
        is_active: row.is_active ?? true,
        is_primary: row.is_primary ?? true,
      }))

      const { error } = await supabase.from("leave_approver_assignments").upsert(payload)
      if (error) return NextResponse.json({ error: "Failed to save assignments" }, { status: 500 })
    }

    return NextResponse.json({ message: "Leave flow configuration saved" })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/flow:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
