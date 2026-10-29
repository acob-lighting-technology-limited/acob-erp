import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJsonBody } from "@/lib/api/parse-body"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient, getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { deviceOutageStartDate, getDeviceHealth } from "@/lib/hr/device-health"
import { logger } from "@/lib/logger"
import { toLocalYearMonth, monthBounds, loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { toLocalISODate } from "@/lib/utils/date"
import { addIsoDays } from "@/lib/hr/leave-days"
import { deriveUnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import { notifyAppealSubmittedMail } from "@/lib/hr/attendance-notify"
import { validateLwpAwpMonthlyQuota } from "@/lib/hr/attendance-quota"
import {
  departmentHasLead,
  employeeAppealStage,
  loadDepartmentLeads,
  notifyAppealReviewers,
  type AppealReviewStage,
} from "@/lib/hr/attendance-appeals"
import { isAdminLikeRole } from "@/lib/admin/rbac"

const log = logger("hr-attendance-appeals")
export const dynamic = "force-dynamic"

const APPEALABLE_STATUSES = ["absent", "late", "incomplete"] as const
type AppealableStatus = (typeof APPEALABLE_STATUSES)[number]

const ALLOWED_REQUESTED_STATUSES = [
  "absent_with_permission",
  "lateness_with_permission",
  "incomplete_with_permission",
  "out_of_station",
] as const
type AllowedRequestedStatus = (typeof ALLOWED_REQUESTED_STATUSES)[number]

function isAppealableStatus(s: string): s is AppealableStatus {
  return (APPEALABLE_STATUSES as readonly string[]).includes(s)
}

function isAllowedRequestedStatus(s: string): s is AllowedRequestedStatus {
  return (ALLOWED_REQUESTED_STATUSES as readonly string[]).includes(s)
}

/**
 * How far back an appeal may reach, in whole months including the current one.
 */
const APPEAL_WINDOW_MONTHS: Record<AllowedRequestedStatus, number> = {
  absent_with_permission: 2,
  lateness_with_permission: 2,
  incomplete_with_permission: 2,
  out_of_station: 6,
}

/** Earliest year-month (YYYY-MM) an appeal may target, given how many months back are allowed. */
function earliestAllowedMonth(monthsBack: number): string {
  const now = new Date()
  return toLocalYearMonth(new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const yearMonth = request.nextUrl.searchParams.get("year_month")

    let query = dataClient
      .from("attendance_appeals")
      .select(
        "id, attendance_record_id, user_id, appeal_date, current_status, requested_status, appeal_reason, status, stage, initiated_by_role, created_by, lead_reviewed_by, lead_reviewed_at, lead_resolution_note, admin_reviewed_by, admin_reviewed_at, admin_resolution_note, reviewed_by, reviewed_at, resolution_note, created_at, updated_at, overridden_by, overridden_at, override_reason, overridden_stage"
      )
      .eq("user_id", user.id)
      .order("appeal_date", { ascending: false })

    if (yearMonth) {
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return NextResponse.json({ error: "year_month is invalid" }, { status: 400 })
      }
      const { start, end } = monthBounds(yearMonth)
      query = query.gte("appeal_date", start).lte("appeal_date", end)
    }

    const { data: appealsData, error } = await query
    if (error) {
      log.error({ err: error }, "Failed to fetch appeals")
      return NextResponse.json({ error: "Failed to fetch appeals" }, { status: 500 })
    }

    const rows = appealsData ?? []
    if (rows.length === 0) return NextResponse.json({ data: [] })

    const userIdsToFetch = new Set<string>()
    for (const r of rows) {
      if (r.user_id) userIdsToFetch.add(r.user_id)
      if (r.created_by) userIdsToFetch.add(r.created_by)
      if (r.lead_reviewed_by) userIdsToFetch.add(r.lead_reviewed_by)
      if (r.admin_reviewed_by) userIdsToFetch.add(r.admin_reviewed_by)
      if (r.reviewed_by) userIdsToFetch.add(r.reviewed_by)
      if (r.overridden_by) userIdsToFetch.add(r.overridden_by)
    }

    type ProfileRow = {
      id: string
      full_name: string | null
      first_name: string | null
      last_name: string | null
      department: string | null
      is_department_lead?: boolean | null
    }

    const { data: profiles } = await dataClient
      .from("profiles")
      .select("id, full_name, first_name, last_name, department, is_department_lead")
      .in("id", Array.from(userIdsToFetch))
      .returns<ProfileRow[]>()

    const profileMap = new Map<string, ProfileRow>()
    for (const p of profiles ?? []) profileMap.set(p.id, p)

    const resolveProfileName = (id?: string | null): string | null => {
      if (!id) return null
      const p = profileMap.get(id)
      if (!p) return null
      return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || null
    }

    const departmentLeads = await loadDepartmentLeads(dataClient)
    const admin_hr_lead_name = departmentLeads.adminHrLeadName

    const data = rows.map((r) => {
      const p = profileMap.get(r.user_id)
      const department = p?.department ?? ""
      const department_lead_name = department ? (departmentLeads.nameByDepartment.get(department) ?? null) : null
      return {
        ...r,
        user_name: resolveProfileName(r.user_id) || "Unknown",
        department,
        department_lead_name,
        created_by_name: resolveProfileName(r.created_by),
        lead_reviewer_name: resolveProfileName(r.lead_reviewed_by),
        admin_reviewer_name: resolveProfileName(r.admin_reviewed_by),
        admin_hr_lead_name,
        overridden_by_name: resolveProfileName(r.overridden_by),
        reviewer_name: r.status === "pending" ? null : resolveProfileName(r.reviewed_by),
      }
    })

    return NextResponse.json({ data })
  } catch (err) {
    log.error({ err: String(err) }, "Error in GET /api/hr/attendance/appeals")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

const APPEAL_FIELDS_REQUIRED = "appeal_date, requested_status, and appeal_reason are required"

const CreateAppealSchema = z.object({
  appeal_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "appeal_date must be in YYYY-MM-DD format"),
  requested_status: z.string().trim().min(1, APPEAL_FIELDS_REQUIRED),
  appeal_reason: z.string().trim().min(1, APPEAL_FIELDS_REQUIRED).max(2000),
  target_user_id: z.string().uuid().optional(),
})

const UpdateAppealSchema = z.object({
  id: z.string().trim().min(1, "id and appeal_reason are required"),
  appeal_reason: z.string().trim().min(10, "appeal_reason must be at least 10 characters").max(2000),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const policy = await loadAttendancePolicy(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = await parseJsonBody(request, CreateAppealSchema)
    if (!parsed.ok) return parsed.response
    const appealDate = parsed.data.appeal_date
    const requestedStatus = parsed.data.requested_status
    const appealReason = parsed.data.appeal_reason
    const targetUserId = parsed.data.target_user_id

    // Validate presence
    if (!appealDate || !requestedStatus || !appealReason) {
      return NextResponse.json(
        { error: "appeal_date, requested_status, and appeal_reason are required" },
        { status: 400 }
      )
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appealDate)) {
      return NextResponse.json({ error: "appeal_date must be in YYYY-MM-DD format" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const today = toLocalISODate()
    const isAdvance = appealDate >= today

    // Advance requests rules
    if (isAdvance) {
      if (requestedStatus === "incomplete_with_permission") {
        return NextResponse.json(
          { error: "Incomplete With Permission (IWP) can only be requested after the day has occurred." },
          { status: 400 }
        )
      }
      const maxAdvanceDate = addIsoDays(today, 30)
      if (appealDate > maxAdvanceDate) {
        return NextResponse.json(
          { error: "Advance permission requests cannot be submitted more than 30 days in advance." },
          { status: 400 }
        )
      }
    }

    // Device outage check only applies for past dates
    if (!isAdvance) {
      const deviceClient = getServiceClient()
      if (deviceClient) {
        const health = await getDeviceHealth(deviceClient).catch((error: unknown) => {
          log.error({ err: String(error) }, "Device health check failed during appeal")
          return null
        })
        if (health?.offline && appealDate >= deviceOutageStartDate(health)) {
          return NextResponse.json(
            {
              error:
                "The clock-in device has lost connection and has not sent all records yet. If you clocked in or out, it is saved on the device and will show once it reconnects. Please check again after it is restored.",
            },
            { status: 409 }
          )
        }
      }
    }

    // Validate requested_status
    if (!isAllowedRequestedStatus(requestedStatus)) {
      return NextResponse.json(
        {
          error: "requested_status must be absent_with_permission, lateness_with_permission, or out_of_station",
        },
        { status: 400 }
      )
    }

    // Validate appeal_date is inside window for past appeals
    if (!isAdvance) {
      const monthsBack = APPEAL_WINDOW_MONTHS[requestedStatus]
      const appealYearMonth = appealDate.slice(0, 7)
      const currentMonth = toLocalYearMonth(new Date())
      const earliestMonth = earliestAllowedMonth(monthsBack)
      if (appealYearMonth > currentMonth || appealYearMonth < earliestMonth) {
        return NextResponse.json(
          {
            error:
              monthsBack <= 2
                ? "Appeals are only allowed for the current or previous month"
                : `Out-of-station appeals are only allowed for the last ${monthsBack} months (from ${earliestMonth})`,
          },
          { status: 400 }
        )
      }
    }

    // Determine target employee & caller roles
    let effectiveUserId = user.id
    let initiatedByRole: "employee" | "lead_on_behalf" = "employee"

    const { data: callerProfile } = await dataClient
      .from("profiles")
      .select("id, department, is_department_lead, role, full_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle<{
        id: string
        department: string | null
        is_department_lead: boolean
        role: string | null
        full_name: string | null
        first_name: string | null
        last_name: string | null
      }>()

    if (targetUserId && targetUserId !== user.id) {
      const { data: targetProfile } = await dataClient
        .from("profiles")
        .select("id, department, is_department_lead, full_name, first_name, last_name")
        .eq("id", targetUserId)
        .maybeSingle<{
          id: string
          department: string | null
          is_department_lead: boolean
          full_name: string | null
          first_name: string | null
          last_name: string | null
        }>()

      if (!targetProfile) {
        return NextResponse.json({ error: "Target employee not found" }, { status: 404 })
      }

      const isCallerLead = Boolean(
        callerProfile?.is_department_lead &&
          callerProfile.department &&
          callerProfile.department === targetProfile.department
      )
      // An admin changes someone else's attendance from the admin page, where it is
      // staged as the admin side. Here only the person's own lead may act for them.
      if (!isCallerLead) {
        return NextResponse.json(
          {
            error: isAdminLikeRole(callerProfile?.role)
              ? "To change someone else's attendance, use the admin attendance page."
              : "You are not authorized to submit appeals on behalf of this employee",
          },
          { status: 403 }
        )
      }

      effectiveUserId = targetUserId
      initiatedByRole = "lead_on_behalf"
    }

    // Check for existing pending/approved appeal for effective user on that day
    const { data: existingAppeal } = await dataClient
      .from("attendance_appeals")
      .select("id, status")
      .eq("user_id", effectiveUserId)
      .eq("appeal_date", appealDate)
      .in("status", ["pending", "approved"])
      // A day can hold several approved appeals (admin/lead changes re-staged later).
      .limit(1)
      .maybeSingle()

    if (existingAppeal) {
      return NextResponse.json({ error: `An active appeal already exists for ${appealDate}` }, { status: 409 })
    }

    // Find attendance record for that date if past
    const { data: attendanceRecord } = await dataClient
      .from("attendance_records")
      .select("id, clock_in, clock_out, status, waived")
      .eq("user_id", effectiveUserId)
      .eq("date", appealDate)
      .maybeSingle()

    // Derive current status
    const currentStatus = isAdvance
      ? "scheduled"
      : deriveUnifiedAttendanceStatus(
          {
            record: attendanceRecord ?? null,
            recordDate: appealDate,
          },
          policy
        )

    if (!isAdvance && !isAppealableStatus(currentStatus)) {
      return NextResponse.json(
        {
          error: `Cannot appeal a day with status '${currentStatus}'. Only absent, late, or incomplete days are eligible.`,
        },
        { status: 422 }
      )
    }

    // For past days, validate requested_status fits
    if (!isAdvance && requestedStatus !== "out_of_station") {
      if (currentStatus === "absent" && requestedStatus !== "absent_with_permission") {
        return NextResponse.json(
          { error: "Absent days can only be appealed as absent_with_permission (AWP) or out_of_station (OOS)" },
          { status: 422 }
        )
      }
      if (
        (currentStatus === "late" || currentStatus === "incomplete") &&
        requestedStatus !== "lateness_with_permission" &&
        requestedStatus !== "incomplete_with_permission"
      ) {
        return NextResponse.json(
          {
            error:
              "Late or incomplete days can only be appealed as lateness_with_permission (LWP), incomplete_with_permission (IWP), or out_of_station (OOS)",
          },
          { status: 422 }
        )
      }
    }

    // Check monthly quota (OOS is uncapped)
    const quotaCheck = await validateLwpAwpMonthlyQuota({
      dataClient,
      userId: effectiveUserId,
      targetStatus: requestedStatus,
      date: appealDate,
      isAdminLike: false,
      excludeRecordId: attendanceRecord?.id ?? null,
      isManualAlteration: false,
    })
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "This employee already has 3 permission days (LWP/AWP/IWP) this month, which is the maximum allowed.",
        },
        { status: 422 }
      )
    }

    // Fetch effective user profile to check if they are a lead
    const { data: effectiveProfile } = await dataClient
      .from("profiles")
      .select("id, department, department_id, is_department_lead, full_name, first_name, last_name")
      .eq("id", effectiveUserId)
      .maybeSingle<{
        id: string
        department: string | null
        department_id: string | null
        is_department_lead: boolean
        full_name: string | null
        first_name: string | null
        last_name: string | null
      }>()

    // A lead submitting for their staff is the lead side, so an admin approves. An
    // employee's own appeal goes to their lead first (see employeeAppealStage).
    const initialStage: AppealReviewStage =
      initiatedByRole === "lead_on_behalf"
        ? "pending_admin"
        : employeeAppealStage(
            effectiveProfile ?? null,
            await departmentHasLead(dataClient, effectiveProfile?.department ?? null)
          )

    const now = new Date().toISOString()
    const insertPayload: Record<string, unknown> = {
      attendance_record_id: attendanceRecord?.id ?? null,
      user_id: effectiveUserId,
      appeal_date: appealDate,
      current_status: currentStatus,
      requested_status: requestedStatus,
      appeal_reason: appealReason,
      status: "pending",
      stage: initialStage,
      initiated_by_role: initiatedByRole,
      created_by: user.id,
    }

    if (initiatedByRole === "lead_on_behalf") {
      insertPayload.lead_reviewed_by = user.id
      insertPayload.lead_reviewed_at = now
      insertPayload.lead_resolution_note = "Submitted on behalf by Department Lead"
    }

    const { data: appeal, error: insertError } = await dataClient
      .from("attendance_appeals")
      .insert(insertPayload)
      .select()
      .single()

    if (insertError || !appeal) {
      log.error({ err: insertError }, "Failed to insert appeal")
      return NextResponse.json({ error: "Failed to submit appeal" }, { status: 500 })
    }

    // Provenance event
    await recordAttendanceEvent(dataClient, {
      userId: effectiveUserId,
      eventDate: appealDate,
      eventType: "appeal_requested",
      attendanceRecordId: attendanceRecord?.id ?? null,
      fromStatus: currentStatus,
      toStatus: requestedStatus,
      source: "appeal",
      comment: appealReason,
      actorId: user.id,
      metadata: { appeal_id: appeal.id, stage: initialStage, initiated_by_role: initiatedByRole },
    })

    // Notifications
    const employeeName =
      effectiveProfile?.full_name?.trim() ||
      [effectiveProfile?.first_name, effectiveProfile?.last_name].filter(Boolean).join(" ") ||
      "An employee"
    await notifyAppealReviewers(dataClient, {
      stage: initialStage,
      department: effectiveProfile?.department ?? null,
      departmentId: effectiveProfile?.department_id ?? null,
      appealId: appeal.id,
      actorId: user.id,
      title: isAdvance ? "Advance Permission Notice" : "Attendance Appeal Submitted",
      message: `${employeeName} has ${isAdvance ? "requested advance permission" : "submitted an appeal"} for ${appealDate} (${requestedStatus}).`,
    })

    if (!isAdvance) {
      await notifyAppealSubmittedMail(dataClient, {
        appellantId: effectiveUserId,
        date: appealDate,
        fromStatus: currentStatus,
        requestedStatus,
        reason: appealReason,
      })
    }

    return NextResponse.json({ data: appeal }, { status: 201 })
  } catch (err) {
    log.error({ err: String(err) }, "Error in POST /api/hr/attendance/appeals")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = await parseJsonBody(request, UpdateAppealSchema)
    if (!parsed.ok) return parsed.response
    const { id, appeal_reason: appealReason } = parsed.data

    if (!id || !appealReason) {
      return NextResponse.json({ error: "id and appeal_reason are required" }, { status: 400 })
    }

    if (appealReason.length < 10) {
      return NextResponse.json({ error: "appeal_reason must be at least 10 characters" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    // Fetch the appeal to verify ownership and pending status
    const { data: appeal, error: fetchError } = await dataClient
      .from("attendance_appeals")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle<{ id: string; user_id: string; status: string }>()

    if (fetchError || !appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 })
    }

    if (appeal.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized to edit this appeal" }, { status: 403 })
    }

    if (appeal.status !== "pending") {
      return NextResponse.json({ error: `Cannot edit an appeal that is already ${appeal.status}` }, { status: 400 })
    }

    const { data: updatedAppeal, error: updateError } = await dataClient
      .from("attendance_appeals")
      .update({
        appeal_reason: appealReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError || !updatedAppeal) {
      log.error({ err: updateError }, "Failed to update appeal reason")
      return NextResponse.json({ error: "Failed to update appeal" }, { status: 500 })
    }

    return NextResponse.json({ data: updatedAppeal })
  } catch (err) {
    log.error({ err: String(err) }, "Error in PATCH /api/hr/attendance/appeals")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const id = request.nextUrl.searchParams.get("id") ?? ""
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    // Fetch the appeal to verify ownership and pending status
    const { data: appeal, error: fetchError } = await dataClient
      .from("attendance_appeals")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle<{ id: string; user_id: string; status: string }>()

    if (fetchError || !appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 })
    }

    if (appeal.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized to cancel this appeal" }, { status: 403 })
    }

    if (appeal.status !== "pending") {
      return NextResponse.json({ error: `Cannot cancel an appeal that is already ${appeal.status}` }, { status: 400 })
    }

    const { error: deleteError } = await dataClient.from("attendance_appeals").delete().eq("id", id)

    if (deleteError) {
      log.error({ err: deleteError }, "Failed to delete appeal")
      return NextResponse.json({ error: "Failed to cancel appeal" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    log.error({ err: String(err) }, "Error in DELETE /api/hr/attendance/appeals")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
