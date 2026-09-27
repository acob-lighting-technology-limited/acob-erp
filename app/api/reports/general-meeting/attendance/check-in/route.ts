import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const CheckInSchema = z.object({
  week: z.number().int().min(1).max(53),
  year: z.number().int().min(2000).max(2100),
  code: z.string().trim().min(6).max(6),
  attendanceMode: z.enum(["physical", "virtual"]).default("physical"),
  source: z.enum(["qr_scan", "code_input"]).default("code_input"),
})

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`gm-attendance-checkin:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please slow down." }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in to Matrix." }, { status: 401 })
  }

  const parsed = CheckInSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid check-in details" }, { status: 400 })
  }

  const { week, year, code, attendanceMode, source } = parsed.data
  const db = getServiceRoleClientOrFallback(supabase)

  // 1. Fetch active meeting session
  const { data: session, error: sessionErr } = await db
    .from("general_meeting_sessions")
    .select("meeting_date, code_6_digit, is_active")
    .eq("meeting_week", week)
    .eq("meeting_year", year)
    .maybeSingle()

  if (sessionErr || !session) {
    return NextResponse.json({ error: "No active meeting session found for this week." }, { status: 404 })
  }

  if (!session.is_active) {
    return NextResponse.json(
      { error: "Attendance check-in for this meeting is currently closed by the coordinator." },
      { status: 403 }
    )
  }

  if (session.code_6_digit !== code) {
    return NextResponse.json(
      { error: "Invalid 6-digit meeting code. Please check the sheet and try again." },
      { status: 400 }
    )
  }

  // 2. BIOMETRIC VALIDATION GATE
  // Look for a clock_in record in attendance_records for today
  const meetingDateIso = session.meeting_date
  const { data: attendanceRow } = await db
    .from("attendance_records")
    .select("clock_in, source")
    .eq("user_id", user.id)
    .eq("date", meetingDateIso)
    .maybeSingle()

  if (!attendanceRow?.clock_in) {
    return NextResponse.json(
      {
        error:
          "Biometric clock-in required: You have not punched in at the office entrance machine today. If you just punched seconds ago, please wait 30 seconds for device sync or speak with the meeting coordinator.",
        code: "BIOMETRIC_PUNCH_REQUIRED",
      },
      { status: 403 }
    )
  }

  // 3. Upsert into general_meeting_attendance
  const nowIso = new Date().toISOString()
  const { data: savedRecord, error: saveErr } = await db
    .from("general_meeting_attendance")
    .upsert(
      {
        meeting_week: week,
        meeting_year: year,
        meeting_date: meetingDateIso,
        user_id: user.id,
        status: "present",
        attendance_mode: attendanceMode,
        source: source,
        office_clock_in: attendanceRow.clock_in,
        meeting_clock_in: nowIso,
        recorded_by: user.id,
        updated_at: nowIso,
      },
      { onConflict: "meeting_week,meeting_year,user_id" }
    )
    .select()
    .single()

  if (saveErr) {
    return NextResponse.json({ error: saveErr.message }, { status: 500 })
  }

  await writeAuditLog(
    supabase,
    {
      action: "create",
      entityType: "general_meeting_attendance",
      entityId: savedRecord.id,
      newValues: {
        week,
        year,
        meetingDate: meetingDateIso,
        source,
        attendanceMode,
        officeClockIn: attendanceRow.clock_in,
        meetingClockIn: nowIso,
      },
      context: { actorId: user.id, source: "api", route: "/api/reports/general-meeting/attendance/check-in" },
    },
    { failOpen: true }
  )

  return NextResponse.json({
    ok: true,
    message: "Attendance confirmed! Verified with your morning office entrance clock-in.",
    record: savedRecord,
  })
}
