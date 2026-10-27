import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import { notifyAppealReviewers, resolvePendingAppealsOnManualStatus } from "@/lib/hr/attendance-appeals"
import { notifyAttendanceInApp } from "@/lib/hr/attendance-notify"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import {
  ATTENDANCE_STATUS_LABELS,
  DB_WRITABLE_STATUSES,
  deriveUnifiedAttendanceStatus,
  type UnifiedAttendanceStatus,
} from "@/lib/hr/attendance-status"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { applyLunchBreak } from "@/lib/hr/attendance-ssot"
import { validateLwpAwpMonthlyQuota } from "@/lib/hr/attendance-quota"

const log = logger("admin-hr-attendance-record-patch")

const PatchSchema = z.object({
  clock_in: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format")
    .optional()
    .nullable(),
  clock_out: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format")
    .optional()
    .nullable(),
  status: z.enum(DB_WRITABLE_STATUSES).optional(),
  waived: z.boolean().optional(),
  manual_comment: z.string().trim().min(3, "Manual attendance changes require a comment").max(500),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`admin-attendance-patch:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const auth = await requireApiAdminScope()
    if (!auth.ok) return auth.response
    const { supabase } = auth
    const policy = await loadAttendancePolicy(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = PatchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
    }

    const { id } = await params
    const dataClient = getServiceRoleClientOrFallback(supabase)

    const { data: record } = await dataClient
      .from("attendance_records")
      .select("id, user_id, clock_in, clock_out, date, status, waived, manual_comment")
      .eq("id", id)
      .maybeSingle()

    if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 })

    const updates: Record<string, unknown> = {
      ...parsed.data,
      source: "manual",
      manual_comment: parsed.data.manual_comment,
    }

    // Any manually-changed punch is attributed to "manual" so the source label can show Mixed.
    // Only set the source when a non-null time is provided; setting clock_in_source on a null
    // punch would leave a dangling source value on a cleared clock-in.
    if (parsed.data.clock_in != null) updates.clock_in_source = "manual"
    if (parsed.data.clock_out != null) updates.clock_out_source = "manual"

    // Recalculate total_hours if both times are known after update
    const clockIn = parsed.data.clock_in !== undefined ? parsed.data.clock_in : record.clock_in
    const clockOut = parsed.data.clock_out !== undefined ? parsed.data.clock_out : record.clock_out
    const explicitStatus = parsed.data.status
    const nextStatus =
      explicitStatus ??
      (parsed.data.waived === true
        ? "waiver"
        : deriveUnifiedAttendanceStatus(
            {
              record: { clock_in: clockIn, clock_out: clockOut, waived: false, status: record.status },
              recordDate: record.date,
            },
            policy
          ))
    const isCoveredWithoutTimes =
      nextStatus === "waiver" || nextStatus === "absent_with_permission" || nextStatus === "out_of_station"
    const isActorAdmin = auth.scope.isAdminLike && auth.scope.scopeMode !== "lead"
    const isAlteringOther = auth.scope.userId !== record.user_id

    // Two-stage rule: an Admin who overrides another person's status cannot apply it
    // unilaterally — it stages as an appeal for Department Lead endorsement, then Admin & HR.
    // Only an explicit status choice (or waiver) counts: a clock-time correction that merely
    // re-derives the status applies directly, because the appeal carries a status and no
    // times, so staging it would drop the corrected punches on approval.
    const overrideStatus = explicitStatus ?? (parsed.data.waived === true ? "waiver" : undefined)
    if (overrideStatus && overrideStatus !== record.status && isActorAdmin && isAlteringOther) {
      if (parsed.data.clock_in !== undefined || parsed.data.clock_out !== undefined) {
        return NextResponse.json(
          {
            error:
              "A status change for another employee needs approval and can't carry clock times. Save the clock-time correction first, then change the status.",
          },
          { status: 400 }
        )
      }

      // Check if an appeal is already active (pending or approved) for this user and date
      const { data: existingAppeal } = await dataClient
        .from("attendance_appeals")
        .select("id, status, stage, requested_status")
        .eq("user_id", record.user_id)
        .eq("appeal_date", record.date)
        .in("status", ["pending", "approved"])
        .maybeSingle()

      if (existingAppeal) {
        if (existingAppeal.status === "pending") {
          const stageLabel = existingAppeal.stage.replace(/_/g, " ")
          return NextResponse.json(
            {
              error: `An alteration or appeal is already pending for this date (Stage: ${stageLabel}). Please review it in the Appeals tab.`,
            },
            { status: 409 }
          )
        }
        return NextResponse.json({ error: "An approved appeal already exists for this date." }, { status: 409 })
      }

      const { data: targetProfile } = await dataClient
        .from("profiles")
        .select("department, department_id, is_department_lead, full_name")
        .eq("id", record.user_id)
        .maybeSingle<{
          department: string | null
          department_id: string | null
          is_department_lead: boolean
          full_name: string | null
        }>()

      const isTargetLead = Boolean(targetProfile?.is_department_lead)
      const targetStage = isTargetLead ? "pending_hr_lead" : "pending_lead"

      const { data: staged, error: stageError } = await dataClient
        .from("attendance_appeals")
        .insert({
          attendance_record_id: record.id,
          user_id: record.user_id,
          appeal_date: record.date,
          current_status: record.status,
          requested_status: overrideStatus,
          appeal_reason: parsed.data.manual_comment,
          status: "pending",
          stage: targetStage,
          initiated_by_role: "admin_manual",
          created_by: auth.scope.userId,
        })
        .select("id")
        .single<{ id: string }>()

      if (stageError || !staged) {
        log.error({ err: stageError }, "Failed to stage manual alteration")
        return NextResponse.json({ error: "Failed to stage alteration" }, { status: 500 })
      }

      await recordAttendanceEvent(dataClient, {
        userId: record.user_id,
        eventDate: record.date,
        eventType: "manual_update",
        attendanceRecordId: record.id,
        fromStatus: record.status,
        toStatus: overrideStatus,
        source: "manual",
        comment: parsed.data.manual_comment,
        actorId: auth.scope.userId,
        metadata: { appeal_id: staged.id, staged_stage: targetStage },
      })

      const statusLabel = ATTENDANCE_STATUS_LABELS[overrideStatus as UnifiedAttendanceStatus] ?? overrideStatus
      await notifyAppealReviewers(dataClient, {
        stage: targetStage,
        department: targetProfile?.department ?? null,
        departmentId: targetProfile?.department_id ?? null,
        appealId: staged.id,
        actorId: auth.scope.userId,
        title: "Attendance Alteration Staged",
        message: `An attendance alteration to ${statusLabel} for ${targetProfile?.full_name ?? "an employee"} on ${record.date} requires your confirmation.`,
      })

      return NextResponse.json({
        data: record,
        staged: true,
        message: `Status alteration to ${statusLabel} staged. Awaiting confirmation from ${isTargetLead ? "Admin & HR Lead" : "Department Lead"}.`,
      })
    }

    const isLWP = nextStatus === "lateness_with_permission" || nextStatus === "incomplete_with_permission"

    const quotaCheck = await validateLwpAwpMonthlyQuota({
      dataClient,
      userId: record.user_id,
      targetStatus: nextStatus,
      date: record.date,
      isAdminLike: auth.scope.isAdminLike,
      excludeRecordId: record.id,
    })
    if (!quotaCheck.allowed) {
      return NextResponse.json({ error: quotaCheck.error }, { status: 403 })
    }

    if (clockIn && clockOut && clockOut <= clockIn) {
      return NextResponse.json({ error: "Clock out must be after clock in" }, { status: 400 })
    }
    if (!isCoveredWithoutTimes && !isLWP && !clockIn && !clockOut) {
      return NextResponse.json({ error: "Provide both clock in and clock out before saving" }, { status: 400 })
    }
    if (!isCoveredWithoutTimes && !isLWP && ((clockIn && !clockOut) || (!clockIn && clockOut))) {
      return NextResponse.json({ error: "Clock in and clock out must be provided together" }, { status: 400 })
    }
    if (isLWP && !clockIn && !clockOut) {
      return NextResponse.json(
        { error: "LWP/IWP requires at least one clock punch (clock in or clock out)" },
        { status: 400 }
      )
    }
    if (nextStatus === "waiver" && !parsed.data.manual_comment.trim()) {
      return NextResponse.json({ error: "Waiver requires a reason or comment" }, { status: 400 })
    }

    if (clockIn && clockOut) {
      const inMs = new Date(`${record.date}T${clockIn}Z`).getTime()
      const outMs = new Date(`${record.date}T${clockOut}Z`).getTime()
      const rawHours = Math.max(0, (outMs - inMs) / (1000 * 60 * 60))
      const { breakMinutes, workedHours } = applyLunchBreak(rawHours, policy)
      updates.total_hours = workedHours
      updates.break_duration = breakMinutes
    } else {
      updates.total_hours = null
      updates.break_duration = null
    }

    updates.status = nextStatus
    updates.waived = nextStatus === "waiver" ? true : Boolean(parsed.data.waived ?? false)
    if (isCoveredWithoutTimes && !clockIn && !clockOut) {
      updates.clock_in = null
      updates.clock_out = null
      updates.clock_in_source = null
      updates.clock_out_source = null
    }

    const { data: updated, error } = await dataClient
      .from("attendance_records")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      log.error({ err: JSON.stringify(error) }, "Failed to update attendance record")
      return NextResponse.json({ error: "Failed to update record" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "attendance_record",
        entityId: id,
        oldValues: record,
        newValues: { ...updates, user_id: record.user_id },
        context: { actorId: user.id, source: "api", route: `/api/admin/hr/attendance/records/${id}` },
      },
      { failOpen: true }
    )

    // Provenance + appeal auto-resolution (replaces the old DB trigger).
    await recordAttendanceEvent(dataClient, {
      userId: record.user_id,
      eventDate: record.date,
      eventType: "manual_update",
      attendanceRecordId: id,
      fromStatus: record.status,
      toStatus: nextStatus,
      source: "manual",
      comment: parsed.data.manual_comment,
      actorId: user.id,
      metadata: { clock_in: clockIn ?? null, clock_out: clockOut ?? null },
    })
    await resolvePendingAppealsOnManualStatus(dataClient, {
      userId: record.user_id,
      dates: [record.date],
      status: nextStatus,
      attendanceRecordId: id,
      comment: parsed.data.manual_comment,
      actorId: user.id,
    })
    await notifyAttendanceInApp(dataClient, {
      affectedUserId: record.user_id,
      actorId: user.id,
      date: record.date,
      fromStatus: record.status,
      toStatus: nextStatus,
      action: "updated",
      entityId: id,
    })

    return NextResponse.json({ data: updated, message: "Record updated" })
  } catch (error) {
    log.error({ err: String(error) }, "Error in PATCH /api/admin/hr/attendance/records/[id]")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`admin-attendance-delete:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const auth = await requireApiAdminScope()
    if (!auth.ok) return auth.response
    const { supabase, scope } = auth
    const policy = await loadAttendancePolicy(supabase)
    const { id } = await params
    const dataClient = getServiceRoleClientOrFallback(supabase)

    const { data: record } = await dataClient
      .from("attendance_records")
      .select(
        "id, user_id, clock_in, clock_out, clock_in_source, clock_out_source, date, status, waived, manual_comment, source"
      )
      .eq("id", id)
      .maybeSingle()

    if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 })

    const hasPunches = Boolean(record.clock_in || record.clock_out)

    if (!hasPunches) {
      // Pure manual entry (e.g. manual AWP/OOS/Waiver on an absent day). Deleting it restores the unrecorded absent day.
      const { error: delErr } = await dataClient.from("attendance_records").delete().eq("id", id)
      if (delErr) {
        log.error({ err: JSON.stringify(delErr) }, "Failed to delete manual attendance record")
        return NextResponse.json({ error: "Failed to delete record" }, { status: 500 })
      }

      await writeAuditLog(
        supabase,
        {
          action: "delete",
          entityType: "attendance_record",
          entityId: id,
          oldValues: record,
          context: { actorId: scope.userId, source: "api", route: `/api/admin/hr/attendance/records/${id}` },
        },
        { failOpen: true }
      )

      await recordAttendanceEvent(dataClient, {
        userId: record.user_id,
        eventDate: record.date,
        eventType: "manual_delete",
        attendanceRecordId: null,
        fromStatus: record.status,
        toStatus: null,
        source: "manual",
        comment: "Manual attendance record deleted — reverted to unrecorded day",
        actorId: scope.userId,
      })

      return NextResponse.json({ message: "Record deleted and reverted to unrecorded day" })
    }

    // Has raw device punch(es) — restore to auto-derived status from punches
    const restoredStatus = deriveUnifiedAttendanceStatus(
      {
        record: { clock_in: record.clock_in, clock_out: record.clock_out, waived: false, status: null },
        recordDate: record.date,
      },
      policy
    )
    const restoredSource = record.clock_in_source || record.clock_out_source || "hikvision"

    const updates: Record<string, unknown> = {
      status: restoredStatus,
      waived: false,
      manual_comment: null,
      source: restoredSource,
    }

    const { data: updated, error: upErr } = await dataClient
      .from("attendance_records")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (upErr) {
      log.error({ err: JSON.stringify(upErr) }, "Failed to revert attendance record")
      return NextResponse.json({ error: "Failed to revert record" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "attendance_record",
        entityId: id,
        oldValues: record,
        newValues: updated,
        context: { actorId: scope.userId, source: "api", route: `/api/admin/hr/attendance/records/${id}` },
      },
      { failOpen: true }
    )

    await recordAttendanceEvent(dataClient, {
      userId: record.user_id,
      eventDate: record.date,
      eventType: "manual_update",
      attendanceRecordId: id,
      fromStatus: record.status,
      toStatus: restoredStatus,
      source: "manual",
      comment: "Manual override removed — reverted to auto-derived punch attendance",
      actorId: scope.userId,
      metadata: { clock_in: record.clock_in, clock_out: record.clock_out },
    })

    return NextResponse.json({ data: updated, message: "Record reverted to auto-derived attendance" })
  } catch (error) {
    log.error({ err: String(error) }, "Error in DELETE /api/admin/hr/attendance/records/[id]")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
