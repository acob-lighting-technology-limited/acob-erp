import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import { requireApiAdminScope, getScopedDepartments, requireAttendanceAdmin } from "@/lib/admin/api-scope"
import { formatLeaveReference, getHolidaySet, notifyUsers } from "@/lib/hr/leave-workflow"
import { addIsoDays, countLeaveDays, nextWorkingDayAfter, trimRangeToWorkingDays } from "@/lib/hr/leave-days"

const log = logger("admin-hr-attendance-leave-manual")
export const dynamic = "force-dynamic"

const ManualLeaveSchema = z.object({
  user_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3, "A reason of at least 3 characters is required").max(500),
})

async function assertInScope(
  dataClient: SupabaseClient,
  scope: Parameters<typeof getScopedDepartments>[0],
  userId: string
): Promise<boolean> {
  const depts = getScopedDepartments(scope)
  if (depts === null) return true
  const { data } = await dataClient
    .from("profiles")
    .select("department")
    .eq("id", userId)
    .maybeSingle<{ department: string | null }>()
  return Boolean(data && depts.includes(data.department || ""))
}

// ── Create an approved leave grant (bypasses the request workflow) ──────────────────────
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-hr-leave-manual:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult
    const adminOnly = requireAttendanceAdmin(scope)
    if (adminOnly) return adminOnly

    const parsed = ManualLeaveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
    }
    const { user_id, leave_type_id, start_date, end_date, reason } = parsed.data
    if (end_date < start_date) {
      return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)
    if (!(await assertInScope(dataClient, scope, user_id))) {
      return NextResponse.json({ error: "Employee is not within your scope" }, { status: 403 })
    }

    // Restriction: Only Sick Leave can be directly recorded/bypassed in Attendance Manager
    const { data: ltRow } = await dataClient
      .from("leave_types")
      .select("id, name, code")
      .eq("id", leave_type_id)
      .maybeSingle<{ id: string; name: string; code?: string | null }>()

    const isSick = Boolean(
      ltRow && (ltRow.name.toLowerCase().includes("sick") || (ltRow.code && ltRow.code.toLowerCase().includes("sick")))
    )

    if (!isSick) {
      return NextResponse.json(
        {
          error:
            "Only Sick Leave can be recorded directly in Attendance Manager. All other leave types must be requested through the standard leave request workflow.",
        },
        { status: 400 }
      )
    }

    // Same working-day rules as an employee-submitted request: weekends and
    // public holidays are neither charged nor allowed to be the end date, and
    // the resumption date is the next real working day.
    const holidays = await getHolidaySet(dataClient, null, start_date, addIsoDays(end_date, 30))
    const workingRange = trimRangeToWorkingDays(start_date, end_date, holidays)
    if (!workingRange) {
      return NextResponse.json(
        { error: "That range contains no working days — weekends and public holidays are not leave days" },
        { status: 400 }
      )
    }

    const effectiveStartDate = workingRange.start_date
    const effectiveEndDate = workingRange.end_date
    const days_count = countLeaveDays(effectiveStartDate, effectiveEndDate, holidays)
    const resume_date = nextWorkingDayAfter(effectiveEndDate, holidays)
    const now = new Date().toISOString()

    const { data: created, error } = await dataClient
      .from("leave_requests")
      .insert({
        user_id,
        leave_type_id,
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        resume_date,
        days_count,
        reason,
        status: "approved",
        approval_stage: "completed",
        current_stage_code: "completed",
        approved_by: scope.userId,
        approved_at: now,
        hr_decision_at: now,
        admin_manual: true,
      })
      .select("id")
      .single()

    if (error || !created) {
      log.error({ err: JSON.stringify(error) }, "Manual leave insert failed")
      return NextResponse.json({ error: "Failed to add leave" }, { status: 500 })
    }

    // No balance to draw down: the approved leave_requests row inserted above is itself what
    // the remaining-days figure is derived from.

    // NOTE: we intentionally do NOT write on_leave rows into attendance_records. Status
    // derivation already returns "on_leave" from the approved leave_requests row, so the
    // roster reflects the leave without us overwriting (and destroying) any real punch
    // records on those days. Removing the leave reverts the day to its real status.

    await recordAttendanceEvent(dataClient, {
      userId: user_id,
      eventDate: effectiveStartDate,
      eventType: "leave_granted",
      toStatus: "on_leave",
      source: "manual",
      comment: reason,
      actorId: scope.userId,
      metadata: {
        leave_request_id: created.id,
        leave_type_id,
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        days_count,
      },
    })

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "leave_request",
        entityId: created.id,
        newValues: {
          user_id,
          leave_type_id,
          start_date: effectiveStartDate,
          end_date: effectiveEndDate,
          days_count,
          status: "approved",
          admin_manual: true,
        },
        context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/attendance/leave/manual" },
      },
      { failOpen: true }
    )

    try {
      const [{ data: adminProfile }] = await Promise.all([
        dataClient.from("profiles").select("full_name, first_name, last_name").eq("id", scope.userId).maybeSingle(),
      ])
      const leaveTypeName = ltRow?.name || "Sick Leave"
      const adminName =
        adminProfile?.full_name ||
        `${adminProfile?.first_name || ""} ${adminProfile?.last_name || ""}`.trim() ||
        "HR Administrator"
      const ref = formatLeaveReference(created.id)
      const refSuffix = ref ? ` — ${ref}` : ""

      await notifyUsers(dataClient, {
        userIds: [user_id],
        title: "Leave recorded on your behalf",
        message: `Approved leave for ${leaveTypeName} was recorded on your behalf by ${adminName} for ${effectiveStartDate} to ${effectiveEndDate} (${days_count} day(s)).`,
        linkUrl: "/leave",
        entityId: created.id,
        emailSubject: `Approved Leave Recorded: ${leaveTypeName}${refSuffix}`,
        emailMessage: `Hello,\n\nApproved leave for ${leaveTypeName} from ${effectiveStartDate} to ${effectiveEndDate} (${days_count} working day(s)) has been recorded on your behalf by ${adminName}.${reason ? `\n\nReason: ${reason}` : ""}\n\nView details: ${process.env.NEXT_PUBLIC_APP_URL || ""}/leave`,
      })
    } catch (notifyErr) {
      log.error({ err: String(notifyErr) }, "Failed to send manual leave notification")
    }

    return NextResponse.json({ success: true, id: created.id, days_count }, { status: 201 })
  } catch (err) {
    log.error({ err: String(err) }, "Manual leave POST failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── List manual leave grants (read-only for audit / removal list) ──────────────────
export async function GET(request: NextRequest) {
  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult
    const adminOnly = requireAttendanceAdmin(scope)
    if (adminOnly) return adminOnly

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const depts = getScopedDepartments(scope)

    const query = dataClient
      .from("leave_requests")
      .select(
        `
        id,
        user_id,
        start_date,
        end_date,
        days_count,
        reason,
        created_at,
        admin_manual,
        profiles!leave_requests_user_id_fkey(id, full_name, first_name, last_name, department),
        leave_types(name)
      `
      )
      .eq("admin_manual", true)
      .order("start_date", { ascending: false })
      .limit(100)

    const { data, error } = await query
    if (error) {
      log.error({ err: JSON.stringify(error) }, "Manual leave fetch failed")
      return NextResponse.json({ error: "Failed to load leave grants" }, { status: 500 })
    }

    type Row = {
      id: string
      user_id: string
      start_date: string
      end_date: string
      days_count: number | null
      reason: string | null
      profiles:
        | {
            id: string
            full_name: string | null
            first_name: string | null
            last_name: string | null
            department: string | null
          }
        | {
            id: string
            full_name: string | null
            first_name: string | null
            last_name: string | null
            department: string | null
          }[]
        | null
      leave_types: { name: string } | { name: string }[] | null
    }

    const rows = (data || []) as unknown as Row[]
    const filtered = depts
      ? rows.filter((r) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
          return p?.department && depts.includes(p.department)
        })
      : rows

    const mapped = filtered.map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const lt = Array.isArray(r.leave_types) ? r.leave_types[0] : r.leave_types
      const name = p?.full_name?.trim() || [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unknown Employee"
      return {
        id: r.id,
        user_id: r.user_id,
        user_name: name,
        start_date: r.start_date,
        end_date: r.end_date,
        leave_type: lt?.name || "Leave",
        days_count: r.days_count,
        notes: r.reason,
      }
    })

    return NextResponse.json({ data: mapped })
  } catch (err) {
    log.error({ err: String(err) }, "Manual leave GET failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── Remove a manual leave grant ──────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult
    const adminOnly = requireAttendanceAdmin(scope)
    if (adminOnly) return adminOnly

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const dataClient = getServiceRoleClientOrFallback(supabase)

    const { data: leave, error: fetchErr } = await dataClient
      .from("leave_requests")
      .select("id, user_id, leave_type_id, days_count, start_date, end_date, admin_manual")
      .eq("id", id)
      .maybeSingle<{
        id: string
        user_id: string
        leave_type_id: string
        days_count: number | null
        start_date: string
        end_date: string
        admin_manual: boolean
      }>()

    if (fetchErr || !leave) {
      return NextResponse.json({ error: "Leave record not found" }, { status: 404 })
    }

    if (!leave.admin_manual) {
      return NextResponse.json(
        { error: "Cannot delete employee-submitted leave here. Manage it through the Leave module." },
        { status: 400 }
      )
    }

    if (!(await assertInScope(dataClient, scope, leave.user_id))) {
      return NextResponse.json({ error: "Employee is not within your scope" }, { status: 403 })
    }

    const { error: deleteErr } = await dataClient.from("leave_requests").delete().eq("id", id)
    if (deleteErr) {
      log.error({ err: JSON.stringify(deleteErr) }, "Manual leave delete failed")
      return NextResponse.json({ error: "Failed to delete leave" }, { status: 500 })
    }

    await recordAttendanceEvent(dataClient, {
      userId: leave.user_id,
      eventDate: leave.start_date,
      eventType: "leave_revoked",
      fromStatus: "on_leave",
      source: "manual",
      comment: "Manual leave record removed by administrator",
      actorId: scope.userId,
      metadata: { leave_request_id: id },
    })

    await writeAuditLog(
      supabase,
      {
        action: "delete",
        entityType: "leave_request",
        entityId: id,
        oldValues: leave,
        context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/attendance/leave/manual" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    log.error({ err: String(err) }, "Manual leave DELETE failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
