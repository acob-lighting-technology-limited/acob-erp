import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveEffectiveMeetingDateIso } from "@/lib/reports/meeting-date"
import { getOfficeWeekMonday } from "@/lib/meeting-week"

export const dynamic = "force-dynamic"

function generate6DigitCode(): string {
  // Generate a random 6-digit numerical string
  return Math.floor(100000 + Math.random() * 900000).toString()
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

  // 2. Check if Monday of this week is a public holiday
  const mondayDate = getOfficeWeekMonday(week, year)
  const mondayIso = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, "0")}-${String(mondayDate.getDate()).padStart(2, "0")}`

  const { data: holidays } = await db
    .from("holiday_calendar")
    .select("holiday_date, name, is_business_day")
    .in("holiday_date", [mondayIso, meetingDate])

  const mondayHoliday = holidays?.find((h) => h.holiday_date === mondayIso && !h.is_business_day)
  const meetingHoliday = holidays?.find((h) => h.holiday_date === meetingDate && !h.is_business_day)

  // 3. Find or auto-create session for this week
  const { data: initialSession, error } = await db
    .from("general_meeting_sessions")
    .select("*")
    .eq("meeting_week", week)
    .eq("meeting_year", year)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let session = initialSession

  if (!session) {
    // Auto-create session with new 6-digit code
    const newCode = generate6DigitCode()
    const { data: created, error: createErr } = await db
      .from("general_meeting_sessions")
      .insert({
        meeting_week: week,
        meeting_year: year,
        meeting_date: meetingDate,
        code_6_digit: newCode,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single()

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 })
    }
    session = created
  }

  return NextResponse.json({
    session,
    holidayInfo: {
      isMondayHoliday: Boolean(mondayHoliday),
      mondayHolidayName: mondayHoliday?.name || null,
      isMeetingDayHoliday: Boolean(meetingHoliday),
      meetingHolidayName: meetingHoliday?.name || null,
      mondayIso,
      meetingDate,
    },
  })
}

const SessionActionSchema = z.object({
  week: z.number().int().min(1).max(53),
  year: z.number().int().min(2000).max(2100),
  action: z.enum(["regenerate_code", "toggle_active"]),
  isActive: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await dbProfileRole(supabase, user.id)
  const role = String(profile?.role || "").toLowerCase()
  const isAllowed = ["developer", "super_admin", "admin"].includes(role) || profile?.is_department_lead === true

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden: Coordinator or Admin access required" }, { status: 403 })
  }

  const parsed = SessionActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 })
  }

  const { week, year, action, isActive } = parsed.data
  const db = getServiceRoleClientOrFallback(supabase)

  if (action === "regenerate_code") {
    const newCode = generate6DigitCode()
    const { data, error } = await db
      .from("general_meeting_sessions")
      .update({
        code_6_digit: newCode,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("meeting_week", week)
      .eq("meeting_year", year)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session: data })
  }

  if (action === "toggle_active") {
    const { data, error } = await db
      .from("general_meeting_sessions")
      .update({
        is_active: typeof isActive === "boolean" ? isActive : true,
        updated_at: new Date().toISOString(),
      })
      .eq("meeting_week", week)
      .eq("meeting_year", year)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session: data })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

async function dbProfileRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase.from("profiles").select("role, is_department_lead").eq("id", userId).maybeSingle()
}
