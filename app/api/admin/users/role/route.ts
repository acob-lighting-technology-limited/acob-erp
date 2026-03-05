import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ADMIN_LIKE = ["developer", "super_admin", "admin"] as const
const ASSIGNABLE_ROLES = ["visitor", "employee", "lead", "admin", "super_admin", "developer"] as const

function canAssignRole(assignerRole: string, targetRole: string): boolean {
  if (assignerRole === "developer") return true
  if (assignerRole === "super_admin") return targetRole !== "developer"
  if (assignerRole === "admin") return ["visitor", "employee", "lead"].includes(targetRole)
  return false
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const targetUserId = String(body?.targetUserId || "")
    const targetRole = String(body?.role || "")
    const employmentStatus = body?.employment_status ? String(body.employment_status) : null

    if (!targetUserId || !targetRole) {
      return NextResponse.json({ error: "Missing targetUserId or role" }, { status: 400 })
    }

    if (!ASSIGNABLE_ROLES.includes(targetRole as (typeof ASSIGNABLE_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role supplied" }, { status: 400 })
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 })
    }

    const { data: actorProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const actorRole = actorProfile?.role || ""

    if (!ADMIN_LIKE.includes(actorRole as (typeof ADMIN_LIKE)[number])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role, department, lead_departments")
      .eq("id", targetUserId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 })
    }

    if (!canAssignRole(actorRole, targetRole)) {
      return NextResponse.json({ error: "You do not have permission to assign this role." }, { status: 403 })
    }

    if (targetProfile.role === "developer" && actorRole !== "developer") {
      return NextResponse.json({ error: "Only developer can modify developer accounts." }, { status: 403 })
    }

    if (targetProfile.role === "developer" && targetRole !== "developer") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "developer")

      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "Cannot downgrade the last developer account." }, { status: 400 })
      }
    }

    const isAdmin = ["developer", "super_admin", "admin"].includes(targetRole)
    const isLead = targetRole === "lead"
    const leadDepartments = isLead
      ? (targetProfile.lead_departments?.length ? targetProfile.lead_departments : [targetProfile.department]).filter(
          Boolean
        )
      : []

    const payload: Record<string, unknown> = {
      role: targetRole,
      is_admin: isAdmin,
      is_department_lead: isLead,
      lead_departments: leadDepartments,
    }

    if (employmentStatus) {
      payload.employment_status = employmentStatus
    }

    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", targetUserId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[admin-users-role]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
