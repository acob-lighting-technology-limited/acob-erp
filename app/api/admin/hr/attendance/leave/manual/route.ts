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
import { leaveStageForAppealStage, notifyAppealReviewers } from "@/lib/hr/attendance-appeals"

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

// ── Stage a sick-leave grant for Lead + Admin & HR approval (bypasses the request workflow) ──
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

    // One leave = one appeal, dated on its first working day. Refuse if that day
    // already has a pending appeal, so the appeal maps back to exactly this leave.
    // (A past approved appeal is history — e.g. the grant being edited — and is fine.)
    const { data: pendingAppeal } = await dataClient
      .from("attendance_appeals")
      .select("id")
      .eq("user_id", user_id)
      .eq("appeal_date", effectiveStartDate)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle<{ id: string }>()
    if (pendingAppeal) {
      return NextResponse.json(
        {
          error: `An appeal or alteration is already pending for ${effectiveStartDate}. Resolve it in the Appeals tab before recording leave from that day.`,
        },
        { status: 409 }
      )
    }

    const { data: targetProfile } = await dataClient
      .from("profiles")
      .select("department, department_id, is_department_lead, full_name")
      .eq("id", user_id)
      .maybeSingle<{
        department: string | null
        department_id: string | null
        is_department_lead: boolean
        full_name: string | null
      }>()

    const isTargetLead = Boolean(targetProfile?.is_department_lead)
    const targetStage = isTargetLead ? "pending_hr_lead" : "pending_lead"
    const approverLabel = isTargetLead ? "Admin & HR Lead" : "Department Lead"
    const leaveTypeName = ltRow?.name || "Sick Leave"

    // Two-stage rule: a manual sick-leave grant is staged, not applied. The pending
    // leave_requests row holds the whole range (and reserves the balance); the single
    // appeal below carries it through Department Lead, then Admin & HR approval.
    // admin_manual rows are skipped by the stale-leave cron, so a back-dated grant
    // is not auto-cancelled while it waits.
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
        status: "pending",
        approval_stage: leaveStageForAppealStage(targetStage),
        current_stage_code: leaveStageForAppealStage(targetStage),
        admin_manual: true,
      })
      .select("id")
      .single()

    if (error || !created) {
      log.error({ err: JSON.stringify(error) }, "Manual leave insert failed")
      return NextResponse.json({ error: "Failed to add leave" }, { status: 500 })
    }

    const { data: firstDayRecord } = await dataClient
      .from("attendance_records")
      .select("id, status")
      .eq("user_id", user_id)
      .eq("date", effectiveStartDate)
      .maybeSingle<{ id: string; status: string | null }>()

    const { data: appeal, error: appealError } = await dataClient
      .from("attendance_appeals")
      .insert({
        attendance_record_id: firstDayRecord?.id ?? null,
        user_id,
        appeal_date: effectiveStartDate,
        current_status: firstDayRecord?.status || "absent",
        requested_status: "on_leave",
        appeal_reason: `${leaveTypeName} ${effectiveStartDate} to ${effectiveEndDate} (${days_count} working day(s)): ${reason}`,
        status: "pending",
        stage: targetStage,
        initiated_by_role: "admin_manual",
        created_by: scope.userId,
      })
      .select("id")
      .single<{ id: string }>()

    if (appealError || !appeal) {
      log.error({ err: JSON.stringify(appealError) }, "Manual leave appeal insert failed")
      // Without its appeal the leave could never be approved — undo it.
      await dataClient.from("leave_requests").delete().eq("id", created.id)
      return NextResponse.json({ error: "Failed to add leave" }, { status: 500 })
    }

    await notifyAppealReviewers(dataClient, {
      stage: targetStage,
      department: targetProfile?.department ?? null,
      departmentId: targetProfile?.department_id ?? null,
      appealId: appeal.id,
      actorId: scope.userId,
      title: `${leaveTypeName} Staged`,
      message: `${leaveTypeName} for ${targetProfile?.full_name ?? "an employee"} (${effectiveStartDate} to ${effectiveEndDate}, ${days_count} day(s)) requires your confirmation.`,
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
          status: "pending",
          admin_manual: true,
        },
        context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/attendance/leave/manual" },
      },
      { failOpen: true }
    )

    try {
      const { data: adminProfile } = await dataClient
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", scope.userId)
        .maybeSingle()
      const adminName =
        adminProfile?.full_name ||
        `${adminProfile?.first_name || ""} ${adminProfile?.last_name || ""}`.trim() ||
        "HR Administrator"
      const ref = formatLeaveReference(created.id)
      const refSuffix = ref ? ` — ${ref}` : ""

      await notifyUsers(dataClient, {
        userIds: [user_id],
        title: `${leaveTypeName} recorded on your behalf`,
        message: `${leaveTypeName} for ${effectiveStartDate} to ${effectiveEndDate} (${days_count} day(s)) was recorded on your behalf by ${adminName} and is awaiting ${approverLabel} approval.`,
        linkUrl: "/leave",
        entityId: created.id,
        emailSubject: `${leaveTypeName} Awaiting Approval${refSuffix}`,
        emailMessage: `Hello,

${leaveTypeName} from ${effectiveStartDate} to ${effectiveEndDate} (${days_count} working day(s)) has been recorded on your behalf by ${adminName} and is awaiting ${approverLabel} approval.${
          reason
            ? `

Reason: ${reason}`
            : ""
        }

View details: ${process.env.NEXT_PUBLIC_APP_URL || ""}/leave`,
      })
    } catch (notifyErr) {
      log.error({ err: String(notifyErr) }, "Failed to send manual leave notification")
    }

    return NextResponse.json(
      {
        success: true,
        id: created.id,
        days_count,
        staged: true,
        message: `${leaveTypeName} for ${days_count} day(s) staged. Awaiting confirmation from ${approverLabel}.`,
      },
      { status: 201 }
    )
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
        status,
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
      status: string
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
        status: r.status,
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
      .select("id, user_id, leave_type_id, days_count, start_date, end_date, admin_manual, status")
      .eq("id", id)
      .maybeSingle<{
        id: string
        user_id: string
        leave_type_id: string
        days_count: number | null
        start_date: string
        end_date: string
        admin_manual: boolean
        status: string
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

    // A still-pending grant has a staged appeal waiting on its first day; close it so
    // nobody approves leave that no longer exists.
    if (leave.status === "pending") {
      const now = new Date().toISOString()
      const { error: appealCloseErr } = await dataClient
        .from("attendance_appeals")
        .update({
          status: "resolved",
          stage: "resolved",
          reviewed_by: scope.userId,
          reviewed_at: now,
          resolution_note: "Leave record removed by administrator",
          updated_at: now,
        })
        .eq("user_id", leave.user_id)
        .eq("appeal_date", leave.start_date)
        .eq("initiated_by_role", "admin_manual")
        .eq("requested_status", "on_leave")
        .eq("status", "pending")
      if (appealCloseErr) log.error({ err: JSON.stringify(appealCloseErr) }, "Failed to close staged leave appeal")
    }

    // Only an approved grant ever showed as on_leave; a pending/rejected one changed nothing.
    if (leave.status === "approved") {
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
    }

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
