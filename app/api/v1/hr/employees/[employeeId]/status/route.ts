import { NextResponse } from "next/server"
import { parseJsonBody } from "@/lib/api/parse-body"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback, syncEmploymentStatusToAuth } from "@/lib/supabase/admin"
import { canAccessAdminSection, resolveAdminScope } from "@/lib/admin/rbac"
import { getExitBlockers } from "@/lib/hr/exit-blockers"
import { logger } from "@/lib/logger"
import type { EmploymentStatus } from "@/types/database"
import { toLocalISODate } from "@/lib/utils/date"
import { serverError } from "@/lib/api/errors"

const log = logger("api-employee-status")

type RouteContext = { params: Promise<{ employeeId: string }> }

async function getAdminContext(employeeId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Unauthorized", status: 401 } as const

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !canAccessAdminSection(scope, "hr")) {
    return { error: "Forbidden", status: 403 } as const
  }

  const id = String(employeeId || "").trim()
  if (!id) return { error: "Employee id is required", status: 400 } as const

  const dataClient = getServiceRoleClientOrFallback(supabase)
  return { supabase, user, scope, dataClient, employeeId: id } as const
}

// GET — return offboarding blockers for an employee
export async function GET(_: Request, { params }: RouteContext) {
  const { employeeId } = await params
  try {
    const ctx = await getAdminContext(employeeId)
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    const blockers = await getExitBlockers(ctx.dataClient, ctx.employeeId)
    return NextResponse.json({ blockers })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load blockers"
    log.error({ error, employeeId }, "GET employee status blockers failed")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH — update employment status
const ChangeStatusSchema = z.object({
  status: z.enum(["active", "suspended", "exited", "on_leave", "contract"], {
    errorMap: () => ({ message: "status is required" }),
  }),
  reason_code: z.string().trim().max(100).optional(),
  reason_label: z.string().trim().max(200).optional(),
  leave_type_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  leave_type_name: z.string().trim().max(100).optional(),
  suspension_end_date: z.string().trim().max(40).nullable().optional(),
  separation_date: z.string().trim().max(40).optional(),
})

export async function PATCH(request: Request, { params }: RouteContext) {
  const { employeeId } = await params
  try {
    const ctx = await getAdminContext(employeeId)
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    const parsed = await parseJsonBody(request, ChangeStatusSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data
    const { status, reason_code, reason_label, leave_type_id, suspension_end_date, separation_date } = body

    // Block exit if employee has active assignments
    if (status === "exited") {
      const blockers = await getExitBlockers(ctx.dataClient, ctx.employeeId)
      if (blockers.total > 0) {
        return NextResponse.json(
          { error: "Cannot exit employee with active assignments. Reassign all blockers first.", blockers },
          { status: 409 }
        )
      }
    }

    // Build profile update payload
    const profileUpdate: Record<string, unknown> = {
      employment_status: status,
      status_changed_at: new Date().toISOString(),
      status_changed_by: ctx.user.id,
    }

    if (status === "exited") {
      profileUpdate.role = "visitor"
      profileUpdate.is_admin = false
      profileUpdate.is_department_lead = false
      profileUpdate.lead_departments = []
      profileUpdate.admin_routes = []
      if (separation_date) profileUpdate.separation_date = separation_date
      if (reason_code) profileUpdate.separation_reason = reason_code
    } else if (status === "on_leave") {
      profileUpdate.leave_type_id = leave_type_id ?? null
    } else if (status === "active") {
      // Re-activation: clear exit/leave fields
      profileUpdate.separation_date = null
      profileUpdate.separation_reason = null
    }

    // Update the profile
    const { error: updateError } = await ctx.dataClient.from("profiles").update(profileUpdate).eq("id", ctx.employeeId)

    if (updateError) {
      log.error({ error: updateError, employeeId: ctx.employeeId }, "Profile status update failed")
      return serverError(log, updateError)
    }

    // Record suspension history
    if (status === "suspended") {
      // Mark any previous active suspensions as inactive
      await ctx.dataClient
        .from("employee_suspensions")
        .update({ is_active: false })
        .eq("employee_id", ctx.employeeId)
        .eq("is_active", true)

      const suspensionReason =
        reason_label ||
        (reason_code === "temporary_access_hold"
          ? "Temporary Access Hold"
          : reason_code === "policy_review"
            ? "Policy Review"
            : reason_code === "security_investigation"
              ? "Security Investigation"
              : reason_code === "compliance_breach"
                ? "Compliance Breach"
                : reason_code === "administrative_hold"
                  ? "Administrative Hold"
                  : reason_code || "Temporary Access Hold")

      await ctx.dataClient.from("employee_suspensions").insert({
        employee_id: ctx.employeeId,
        suspended_by: ctx.user.id,
        reason: suspensionReason,
        start_date: toLocalISODate(),
        created_at: new Date().toISOString(),
        end_date: suspension_end_date || null,
        is_active: true,
      })
    }

    // Lift active suspensions when reinstating
    if (status === "active") {
      await ctx.dataClient
        .from("employee_suspensions")
        .update({ is_active: false, lifted_by: ctx.user.id, lifted_at: new Date().toISOString() })
        .eq("employee_id", ctx.employeeId)
        .eq("is_active", true)
    }

    // Sync new status into JWT metadata so the middleware fast-path sees it immediately.
    // Also invalidates the active session so the user is forced to re-authenticate.
    await syncEmploymentStatusToAuth(ctx.employeeId, status)

    log.info({ employeeId: ctx.employeeId, newStatus: status, changedBy: ctx.user.id }, "Employment status updated")
    return NextResponse.json({ message: "Status updated successfully" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update status"
    log.error({ error, employeeId }, "PATCH employee status failed")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
