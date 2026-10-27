import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { recordAttendanceEvents } from "@/lib/hr/attendance-events"
import { requireApiAdminScope, getScopedDepartments, requireAttendanceAdmin } from "@/lib/admin/api-scope"
import {
  ATTENDANCE_STATUS_LABELS,
  DB_WRITABLE_STATUSES,
  deriveUnifiedAttendanceStatus,
  type UnifiedAttendanceStatus,
} from "@/lib/hr/attendance-status"
import { toLocalISODate } from "@/lib/utils/date"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { validateLwpAwpMonthlyQuota } from "@/lib/hr/attendance-quota"
import {
  notifyAppealReviewers,
  stageAttendanceChange,
  stagingRoute,
  type StagingTarget,
} from "@/lib/hr/attendance-appeals"

const log = logger("admin-hr-attendance-records-bulk")
export const dynamic = "force-dynamic"

// Helper to generate an inclusive list of ISO dates between two dates
function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + "T00:00:00Z")
  const last = new Date(end + "T00:00:00Z")
  while (cur <= last) {
    dates.push(toLocalISODate(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

function isWeekend(date: string): boolean {
  const d = new Date(date + "T12:00:00Z")
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

const BulkCreateSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(200),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(DB_WRITABLE_STATUSES),
  manual_comment: z.string().trim().min(3, "A comment of at least 3 characters is required").max(500),
})

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-attendance-bulk:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult
    const adminOnly = requireAttendanceAdmin(scope)
    if (adminOnly) return adminOnly
    const policy = await loadAttendancePolicy(supabase)

    const parsed = BulkCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
    }

    const { user_ids, start_date, end_date, status, manual_comment } = parsed.data

    if (status === "waiver" && !manual_comment.trim()) {
      return NextResponse.json({ error: "Waiver requires a reason or comment" }, { status: 400 })
    }

    if (end_date < start_date) {
      return NextResponse.json({ error: "end_date must be on or after start_date" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    // Validate all user_ids are within caller's scope
    const depts = getScopedDepartments(scope)
    let allowedIds: string[] = user_ids
    if (depts !== null) {
      const { data: scopedProfiles } = await dataClient
        .from("profiles")
        .select("id")
        .in("id", user_ids)
        .in("department", depts)
      allowedIds = (scopedProfiles ?? []).map((p) => p.id)
      if (allowedIds.length === 0) {
        return NextResponse.json({ error: "None of the selected employees are within your scope" }, { status: 403 })
      }
    }

    // Generate all dates in the range. OOS spans weekends (field work / out-of-station directives continue through weekends);
    // other bulk statuses (waivers, permissions) apply only to workdays.
    const includeWeekends = status === "out_of_station"
    const dates = dateRange(start_date, end_date).filter((d) => includeWeekends || !isWeekend(d))
    if (dates.length === 0) {
      return NextResponse.json(
        {
          error: includeWeekends
            ? "No dates found in the specified date range"
            : "No workdays found in the specified date range",
        },
        { status: 400 }
      )
    }

    if (
      ["lateness_with_permission", "incomplete_with_permission", "absent_with_permission"].includes(status) &&
      !scope.isAdminLike
    ) {
      for (const uid of allowedIds) {
        const check = await validateLwpAwpMonthlyQuota({
          dataClient,
          userId: uid,
          targetStatus: status,
          date: start_date,
          isAdminLike: false,
        })
        if (!check.allowed) {
          return NextResponse.json({ error: check.error }, { status: 403 })
        }
      }
    }

    // Two-stage rule: a bulk change is a status override for each person and day, so it is
    // staged per day exactly like a single edit (the final approval writes the day and keeps
    // any real punches). Each person's reviewer gets one notice for the whole batch.
    type ExistingRow = {
      id: string
      user_id: string
      date: string
      status: string
      clock_in: string | null
      clock_out: string | null
    }
    const { data: existingRecords } = await dataClient
      .from("attendance_records")
      .select("id, user_id, date, status, clock_in, clock_out")
      .in("user_id", allowedIds)
      .in("date", dates)

    const existingByKey = new Map<string, ExistingRow>()
    for (const r of (existingRecords ?? []) as ExistingRow[]) existingByKey.set(`${r.user_id}::${r.date}`, r)

    const { data: targetRows } = await dataClient
      .from("profiles")
      .select("id, department, department_id, is_department_lead, full_name")
      .in("id", allowedIds)
      .returns<Array<StagingTarget & { id: string }>>()
    const targets = new Map((targetRows ?? []).map((t) => [t.id, t]))

    let stagedCount = 0
    let skipped = 0
    let alreadyPending = 0
    const statusLabel = ATTENDANCE_STATUS_LABELS[status as UnifiedAttendanceStatus] ?? status

    for (const userId of allowedIds) {
      const target = targets.get(userId) ?? null
      const stagedForUser: Array<{ appealId: string; date: string }> = []
      for (const date of dates) {
        const existing = existingByKey.get(`${userId}::${date}`)
        // OOS never overrides a fully-present day (clock-in AND clock-out): the person
        // was demonstrably in the office, so they cannot be out of station that day. A
        // day with a clock-in but NO clock-out is the "clocked in, then left for OOS
        // and never clocked out" case, which IS a legitimate override. Waiver keeps
        // overriding any day — its purpose is to forgive a late/complete clock-in.
        if (status === "out_of_station" && existing?.clock_in && existing.clock_out) {
          skipped++
          continue
        }
        if (existing?.status === status) {
          skipped++
          continue
        }
        const result = await stageAttendanceChange(dataClient, {
          actor: scope,
          userId,
          date,
          attendanceRecordId: existing?.id ?? null,
          currentStatus: existing?.status ?? deriveUnifiedAttendanceStatus({ record: null, recordDate: date }, policy),
          requestedStatus: status,
          reason: manual_comment,
          target,
          notify: false,
        })
        if (result.ok) {
          stagedCount++
          stagedForUser.push({ appealId: result.appealId, date })
        } else if (result.status === 409) {
          alreadyPending++
        } else {
          return NextResponse.json(
            { error: `${result.error}. ${stagedCount} day(s) were staged before this failed.` },
            { status: result.status }
          )
        }
      }

      if (stagedForUser.length > 0) {
        const route = stagingRoute(scope, target)
        const first = stagedForUser[0].date
        const last = stagedForUser[stagedForUser.length - 1].date
        await notifyAppealReviewers(dataClient, {
          stage: route.stage,
          department: target?.department ?? null,
          departmentId: target?.department_id ?? null,
          appealId: stagedForUser[0].appealId,
          actorId: scope.userId,
          title: "Attendance Alteration Staged",
          message: `${stagedForUser.length} day(s) of ${statusLabel} for ${target?.full_name ?? "an employee"} (${first === last ? first : `${first} to ${last}`}) require your confirmation.`,
        })
      }
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "attendance_record_bulk",
        entityId: `bulk-${status}-${start_date}-${end_date}`,
        newValues: { user_ids: allowedIds, start_date, end_date, status, manual_comment, staged: stagedCount },
        context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/attendance/records/bulk" },
      },
      { failOpen: true }
    )

    const notes: string[] = []
    if (skipped > 0) notes.push(`${skipped} day(s) skipped (already ${statusLabel} or fully present)`)
    if (alreadyPending > 0) notes.push(`${alreadyPending} day(s) already have a pending appeal`)
    return NextResponse.json({
      staged: true,
      message:
        stagedCount > 0
          ? `${stagedCount} day(s) of ${statusLabel} staged for confirmation.${notes.length ? ` ${notes.join("; ")}.` : ""}`
          : `Nothing staged.${notes.length ? ` ${notes.join("; ")}.` : ""}`,
      staged_count: stagedCount,
      skipped,
      already_pending: alreadyPending,
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/admin/hr/attendance/records/bulk")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
})

export async function DELETE(request: NextRequest) {
  const rl = await rateLimit(`admin-attendance-bulk-delete:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult
    const adminOnly = requireAttendanceAdmin(scope)
    if (adminOnly) return adminOnly
    const policy = await loadAttendancePolicy(supabase)

    const parsed = BulkDeleteSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    // Load the target rows and restrict to the caller's department scope
    type TargetRow = {
      id: string
      user_id: string
      date: string
      status: string
      clock_in: string | null
      clock_out: string | null
    }
    const { data: rows } = await dataClient
      .from("attendance_records")
      .select("id, user_id, date, status, clock_in, clock_out")
      .in("id", parsed.data.ids)

    let target = (rows ?? []) as TargetRow[]
    const depts = getScopedDepartments(scope)
    if (depts !== null) {
      const userIds = [...new Set(target.map((r) => r.user_id))]
      const { data: scopedProfiles } = await dataClient
        .from("profiles")
        .select("id")
        .in("id", userIds)
        .in("department", depts)
      const allowed = new Set((scopedProfiles ?? []).map((p) => p.id))
      target = target.filter((r) => allowed.has(r.user_id))
    }

    if (target.length === 0) {
      return NextResponse.json({ error: "No deletable records found in your scope" }, { status: 403 })
    }

    // Graceful reversal: rows that have real punches were overrides — revert their status by
    // re-deriving from the punches (keeping the clock-ins). Rows with no punch were pure
    // manual records (OOS/waiver on an absent day) — delete them.
    const toRevert = target.filter((r) => Boolean(r.clock_in || r.clock_out))
    const toRemove = target.filter((r) => !(r.clock_in || r.clock_out))

    if (toRemove.length > 0) {
      const { error } = await dataClient
        .from("attendance_records")
        .delete()
        .in(
          "id",
          toRemove.map((r) => r.id)
        )
      if (error) {
        log.error({ err: JSON.stringify(error) }, "Bulk delete failed")
        return NextResponse.json({ error: "Failed to delete records" }, { status: 500 })
      }
    }

    for (const row of toRevert) {
      const revertedStatus = deriveUnifiedAttendanceStatus(
        {
          record: { clock_in: row.clock_in, clock_out: row.clock_out, waived: false, status: null },
          recordDate: row.date,
        },
        policy
      )
      await dataClient
        .from("attendance_records")
        .update({ status: revertedStatus, waived: false, manual_comment: null, source: "hikvision" })
        .eq("id", row.id)
    }

    for (const row of target) {
      const reverted = Boolean(row.clock_in || row.clock_out)
      await writeAuditLog(
        supabase,
        {
          action: reverted ? "update" : "delete",
          entityType: "attendance_record",
          entityId: row.id,
          oldValues: { status: row.status, date: row.date, user_id: row.user_id },
          context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/attendance/records/bulk" },
        },
        { failOpen: true }
      )
    }

    // Provenance: reverted days log a manual_update (restored), removed days a bulk_delete.
    await recordAttendanceEvents(
      dataClient,
      target.map((row) => {
        const reverted = Boolean(row.clock_in || row.clock_out)
        return {
          userId: row.user_id,
          eventDate: row.date,
          eventType: reverted ? ("manual_update" as const) : ("bulk_delete" as const),
          attendanceRecordId: reverted ? row.id : null,
          fromStatus: row.status,
          source: "manual" as const,
          comment: reverted ? "Override removed — reverted to recorded attendance" : null,
          actorId: scope.userId,
        }
      })
    )

    return NextResponse.json({
      message: `Removed ${target.length} entr(ies)`,
      deleted: toRemove.length,
      reverted: toRevert.length,
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in DELETE /api/admin/hr/attendance/records/bulk")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
