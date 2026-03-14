import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ADMIN_LIKE_ROLES,
  ASSIGNABLE_ROLES,
  canAssignRole,
  canManageDeveloperAccounts,
  canManageSuperAdminAccounts,
} from "@/lib/role-management"
import { logger } from "@/lib/logger"
import { syncEmploymentStatusToAuth } from "@/lib/supabase/admin"

const log = logger("admin-users-role")

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
    const adminDomains = Array.isArray(body?.admin_domains)
      ? body.admin_domains
          .map((value: unknown) =>
            String(value || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      : []
    const employmentStatus = body?.employment_status ? String(body.employment_status) : null
    const allowedAdminDomains = ["hr", "finance", "assets", "reports", "tasks", "projects", "communications"]

    if (!targetUserId || !targetRole) {
      return NextResponse.json({ error: "Missing targetUserId or role" }, { status: 400 })
    }

    if (!ASSIGNABLE_ROLES.includes(targetRole as (typeof ASSIGNABLE_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role supplied" }, { status: 400 })
    }
    if (targetRole === "admin") {
      if (adminDomains.length === 0) {
        return NextResponse.json({ error: "Admin role requires at least one admin domain." }, { status: 400 })
      }
      if (adminDomains.some((value: string) => !allowedAdminDomains.includes(value))) {
        return NextResponse.json({ error: "Invalid admin domain supplied." }, { status: 400 })
      }
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 })
    }

    const { data: actorProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const actorRole = actorProfile?.role || ""

    if (!ADMIN_LIKE_ROLES.includes(actorRole as (typeof ADMIN_LIKE_ROLES)[number])) {
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

    if (targetProfile.role === "developer" && !canManageDeveloperAccounts(actorRole)) {
      return NextResponse.json(
        { error: "Only super admin or developer can modify developer accounts." },
        { status: 403 }
      )
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

    if (targetRole === "developer" && !canManageDeveloperAccounts(actorRole)) {
      return NextResponse.json(
        { error: "Only super admin or developer can assign the developer role." },
        { status: 403 }
      )
    }

    if (
      (targetProfile.role === "super_admin" || targetRole === "super_admin") &&
      !canManageSuperAdminAccounts(actorRole)
    ) {
      return NextResponse.json({ error: "Only super admin can manage super admin accounts." }, { status: 403 })
    }

    if (targetProfile.role === "super_admin" && targetRole !== "super_admin") {
      const { count, error: superAdminCountError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin")

      if (superAdminCountError) {
        return NextResponse.json({ error: superAdminCountError.message }, { status: 400 })
      }

      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "Cannot downgrade the last super admin account." }, { status: 400 })
      }
    }

    // Role changes do NOT affect department lead status — those are independent
    const payload: Record<string, unknown> = {
      role: targetRole,
      admin_domains: targetRole === "admin" ? adminDomains : null,
    }

    if (employmentStatus) {
      payload.employment_status = employmentStatus
    }

    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", targetUserId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // Sync employment_status into JWT metadata so middleware doesn't need a DB query
    if (employmentStatus) {
      await syncEmploymentStatusToAuth(targetUserId, employmentStatus)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ err: String(error) }, "[admin-users-role]")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
