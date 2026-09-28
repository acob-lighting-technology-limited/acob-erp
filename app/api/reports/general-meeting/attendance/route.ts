import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveEffectiveMeetingDateIso } from "@/lib/reports/meeting-date"
import { getOfficeWeekMonday } from "@/lib/meeting-week"
import { normalizeDepartmentName } from "@/shared/departments"
import { getAvatarSignedUrls } from "@/lib/profile-photos"
import { writeAuditLog } from "@/lib/audit/write-audit"

export const dynamic = "force-dynamic"

export type AttendanceRosterItem = {
  id: string
  full_name: string
  department: string
  designation: string | null
  avatar_url: string | null
  employment_status: string | null
  // Biometric entrance punch
  office_clock_in: string | null
  office_clock_in_source: string | null
  // Meeting check-in
  meeting_clock_in: string | null
  attendance_id: string | null
  status: "present" | "late" | "absent" | "excused" | "on_leave" | "unrecorded"
  source: "qr_scan" | "code_input" | "manual" | "teams_sync" | null
  attendance_mode: "physical" | "virtual" | "hybrid" | null
  manual_comment: string | null
  recorded_by_name: string | null
  is_on_leave: boolean
  leave_type: string | null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const week = Number(request.nextUrl.searchParams.get("week"))
  const year = Number(request.nextUrl.searchParams.get("year"))

  if (!Number.isFinite(week) || !Number.isFinite(year) || week < 1 || week > 53) {
    return NextResponse.json({ error: "Invalid week or year" }, { status: 400 })
  }

  const db = getServiceRoleClientOrFallback(supabase)

  // 1. Resolve meeting date
  let meetingDate: string
  try {
    meetingDate = await resolveEffectiveMeetingDateIso(db, week, year)
  } catch {
    const monday = getOfficeWeekMonday(week, year)
    const yyyy = monday.getFullYear()
    const mm = String(monday.getMonth() + 1).padStart(2, "0")
    const dd = String(monday.getDate()).padStart(2, "0")
    meetingDate = `${yyyy}-${mm}-${dd}`
  }

  // 2. Fetch all regular employees (excluding contract staff without company email and exited staff — matching Directory Employees tab)
  const { data: profiles, error: profErr } = await db
    .from("profiles")
    .select(
      "id, full_name, first_name, last_name, company_email, department, designation, employment_status, employment_type, avatar_path, avatar_url"
    )
    .order("full_name", { ascending: true })

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })

  type ProfileRow = {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
    company_email: string | null
    department: string | null
    designation: string | null
    employment_status: string | null
    employment_type: string | null
    avatar_path: string | null
    avatar_url: string | null
  }

  // Filter out exited employees in JS (matches directory route: null !== "exited" is true)
  const visibleProfiles = ((profiles as unknown as ProfileRow[]) || []).filter((p) => p.employment_status !== "exited")

  const regularEmployees = visibleProfiles.filter((p) => {
    const isContract =
      ((p.employment_status || "").toLowerCase() === "contract" ||
        (p.employment_type || "").toLowerCase() === "contract") &&
      !p.company_email
    return !isContract
  })

  // Sign profile photo URLs
  const signedUrlsByPath = await getAvatarSignedUrls(
    db,
    regularEmployees.map((r) => r.avatar_path).filter((path): path is string => Boolean(path))
  )

  // 3. Fetch attendance records for this meeting date (office entrance biometrics)
  const { data: biometricRecords } = await db
    .from("attendance_records")
    .select("user_id, clock_in, source")
    .eq("date", meetingDate)

  const biometricMap = new Map<string, { clock_in: string | null; source: string | null }>()
  for (const b of biometricRecords || []) {
    if (b.user_id) biometricMap.set(b.user_id, { clock_in: b.clock_in, source: b.source })
  }

  // 4. Fetch general meeting attendance records
  type MeetingRecordRow = {
    id: string
    user_id: string
    status: string
    attendance_mode: string
    source: string
    office_clock_in: string | null
    meeting_clock_in: string | null
    manual_comment: string | null
    recorded_by: string | null
  }

  const { data: meetingRecords } = await db
    .from("general_meeting_attendance")
    .select(
      "id, user_id, status, attendance_mode, source, office_clock_in, meeting_clock_in, manual_comment, recorded_by"
    )
    .eq("meeting_week", week)
    .eq("meeting_year", year)

  const meetingMap = new Map<string, MeetingRecordRow>()
  for (const m of (meetingRecords as MeetingRecordRow[]) || []) {
    if (m.user_id) meetingMap.set(m.user_id, m)
  }

  // 5. Fetch approved leave requests spanning meetingDate
  const { data: leaves } = await db
    .from("leave_requests")
    .select("user_id, leave_type:leave_types(name), start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", meetingDate)
    .gte("end_date", meetingDate)

  const leaveMap = new Map<string, string>()
  for (const l of leaves || []) {
    const typeName = (l.leave_type as unknown as { name?: string })?.name || "Approved Leave"
    leaveMap.set(l.user_id, typeName)
  }

  // 6. Assemble Directory-Style List
  const items: AttendanceRosterItem[] = []
  let countOfficeClockedIn = 0
  let countMeetingPresent = 0
  let countOfficeNotScanned = 0
  let countOnLeave = 0
  let countAbsent = 0

  for (const p of regularEmployees) {
    const bio = biometricMap.get(p.id)
    const meet = meetingMap.get(p.id)
    const leaveTypeName = leaveMap.get(p.id)
    const isOnLeave = Boolean(leaveTypeName)

    const officeClockIn = meet?.office_clock_in || bio?.clock_in || null
    const officeClockInSource = bio?.source || null
    const meetingClockIn = meet?.meeting_clock_in || null

    let finalStatus: AttendanceRosterItem["status"] = "unrecorded"

    if (isOnLeave) {
      finalStatus = "on_leave"
      countOnLeave++
    } else if (meet?.status) {
      finalStatus = meet.status as AttendanceRosterItem["status"]
      if (finalStatus === "present" || finalStatus === "late") countMeetingPresent++
      if (finalStatus === "absent") countAbsent++
    } else {
      finalStatus = "unrecorded"
    }

    if (officeClockIn) {
      countOfficeClockedIn++
      if (!meetingClockIn && !isOnLeave) {
        countOfficeNotScanned++
      }
    }

    items.push({
      id: p.id,
      full_name: p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Staff Member",
      department: normalizeDepartmentName(p.department) || "Unassigned",
      designation: p.designation || null,
      avatar_url: (p.avatar_path ? signedUrlsByPath.get(p.avatar_path) : null) || p.avatar_url || null,
      employment_status: p.employment_status || null,
      office_clock_in: officeClockIn,
      office_clock_in_source: officeClockInSource,
      meeting_clock_in: meetingClockIn,
      attendance_id: meet?.id || null,
      status: finalStatus,
      source: (meet?.source as AttendanceRosterItem["source"]) || null,
      attendance_mode: (meet?.attendance_mode as AttendanceRosterItem["attendance_mode"]) || null,
      manual_comment: meet?.manual_comment || null,
      recorded_by_name: null,
      is_on_leave: isOnLeave,
      leave_type: leaveTypeName || null,
    })
  }

  return NextResponse.json({
    meetingDate,
    items,
    stats: {
      totalStaff: items.length,
      officeClockedIn: countOfficeClockedIn,
      meetingPresent: countMeetingPresent,
      officeNotScanned: countOfficeNotScanned,
      onLeave: countOnLeave,
      absent: countAbsent,
    },
  })
}

const ManualActionSchema = z.object({
  week: z.number().int().min(1).max(53),
  year: z.number().int().min(2000).max(2100),
  userId: z.string().uuid(),
  action: z.enum(["manual_upsert", "manual_delete", "confirm_in_room"]),
  status: z.enum(["present", "late", "absent", "excused", "on_leave"]).optional(),
  attendanceMode: z.enum(["physical", "virtual", "hybrid"]).optional(),
  meetingClockIn: z.string().optional(),
  manualComment: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_department_lead")
    .eq("id", user.id)
    .maybeSingle()
  const role = String(profile?.role || "").toLowerCase()
  const isAllowed = ["developer", "super_admin", "admin"].includes(role) || profile?.is_department_lead === true

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden: Coordinator or Admin access required" }, { status: 403 })
  }

  const parsed = ManualActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 })
  }

  const { week, year, userId, action, status, attendanceMode, meetingClockIn, manualComment } = parsed.data
  const db = getServiceRoleClientOrFallback(supabase)

  // Resolve meeting date
  let meetingDate: string
  try {
    meetingDate = await resolveEffectiveMeetingDateIso(db, week, year)
  } catch {
    const monday = getOfficeWeekMonday(week, year)
    const yyyy = monday.getFullYear()
    const mm = String(monday.getMonth() + 1).padStart(2, "0")
    const dd = String(monday.getDate()).padStart(2, "0")
    meetingDate = `${yyyy}-${mm}-${dd}`
  }

  if (action === "manual_delete") {
    const { error } = await db
      .from("general_meeting_attendance")
      .delete()
      .eq("meeting_week", week)
      .eq("meeting_year", year)
      .eq("user_id", userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(
      supabase,
      {
        action: "delete",
        entityType: "general_meeting_attendance",
        entityId: `${week}-${year}-${userId}`,
        context: { actorId: user.id, source: "api", route: "/api/reports/general-meeting/attendance" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ ok: true, deleted: true })
  }

  // For confirm_in_room or manual_upsert:
  // Lookup any biometric entrance punch if available
  const { data: bioRow } = await db
    .from("attendance_records")
    .select("clock_in")
    .eq("user_id", userId)
    .eq("date", meetingDate)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  const resolvedClockIn = meetingClockIn ? new Date(meetingClockIn).toISOString() : nowIso
  const resolvedStatus = action === "confirm_in_room" ? "present" : status || "present"

  const { data: saved, error } = await db
    .from("general_meeting_attendance")
    .upsert(
      {
        meeting_week: week,
        meeting_year: year,
        meeting_date: meetingDate,
        user_id: userId,
        status: resolvedStatus,
        attendance_mode: attendanceMode || "physical",
        source: "manual",
        office_clock_in: bioRow?.clock_in || null,
        meeting_clock_in: resolvedClockIn,
        manual_comment: manualComment || (action === "confirm_in_room" ? "Confirmed in room by coordinator" : null),
        recorded_by: user.id,
        updated_at: nowIso,
      },
      { onConflict: "meeting_week,meeting_year,user_id" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(
    supabase,
    {
      action: action === "confirm_in_room" ? "approve" : "update",
      entityType: "general_meeting_attendance",
      entityId: saved.id,
      newValues: {
        week,
        year,
        targetUserId: userId,
        status: resolvedStatus,
        meetingClockIn: resolvedClockIn,
        manualComment,
        action,
      },
      context: { actorId: user.id, source: "api", route: "/api/reports/general-meeting/attendance" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true, record: saved })
}
