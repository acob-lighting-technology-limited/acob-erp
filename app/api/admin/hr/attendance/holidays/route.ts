import { NextRequest, NextResponse } from "next/server"
import { requireAdminRole } from "@/lib/admin/require-admin-role"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { monthBounds } from "@/lib/hr/attendance-utils"
import { repriceLeaveForHolidayChange } from "@/lib/hr/leave-holiday-recalc"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/hr/attendance/holidays")

const HolidaySchema = z.object({
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  holiday_date_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  name: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
})

/** Returns every YYYY-MM-DD from start to end inclusive (capped to guard against huge ranges). */
function expandDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  let guard = 0
  while (cursor.getTime() <= last.getTime() && guard < 366) {
    const year = cursor.getUTCFullYear()
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0")
    const day = String(cursor.getUTCDate()).padStart(2, "0")
    dates.push(`${year}-${month}-${day}`)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    guard++
  }
  return dates
}

function ensureAdmin(request: NextRequest) {
  return requireAdminRole(request, "hr.attendance", "admin-attendance-holidays", 20)
}

export async function GET(request: NextRequest) {
  const auth = await ensureAdmin(request)
  if ("error" in auth) return auth.error

  const month = String(request.nextUrl.searchParams.get("month") || "")
  const location = String(request.nextUrl.searchParams.get("location") || "all").trim() || "all"
  const dataClient = getServiceRoleClientOrFallback(auth.supabase)
  let query = dataClient.from("holiday_calendar").select("*").order("holiday_date", { ascending: true })
  query = query.eq("location", location)
  if (/^\d{4}-\d{2}$/.test(month)) {
    const { start, end } = monthBounds(month)
    query = query.gte("holiday_date", start).lte("holiday_date", end)
  }
  const { data, error } = await query
  if (error) return serverError(log, error)
  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin(request)
  if ("error" in auth) return auth.error

  const parsed = HolidaySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const dataClient = getServiceRoleClientOrFallback(auth.supabase)
  const startDate = parsed.data.holiday_date
  const endDate = parsed.data.holiday_date_end
  const location = (parsed.data.location || "all").trim() || "all"
  const name = (parsed.data.name || "Holiday").trim() || "Holiday"

  if (endDate && endDate < startDate) {
    return NextResponse.json({ error: "End date cannot be before start date" }, { status: 400 })
  }

  const dates = endDate ? expandDateRange(startDate, endDate) : [startDate]
  const rows = dates.map((holiday_date) => ({ holiday_date, location, name, created_by: auth.userId }))

  // Ignore days already marked as holidays so re-adding an overlapping range is safe.
  const { error: insertError } = await dataClient
    .from("holiday_calendar")
    .upsert(rows, { onConflict: "holiday_date,location", ignoreDuplicates: true })
  if (insertError) return serverError(log, insertError, "Failed to add holiday")

  // Leave booked before this holiday existed was priced without it. Hand the
  // day back on any request that has not started yet.
  const reprice = await repriceLeaveForHolidayChange(dataClient, {
    fromDate: startDate,
    toDate: endDate || startDate,
    actorId: auth.userId,
    reason: `Holiday added: ${name}`,
  })

  const baseMessage = dates.length > 1 ? `${dates.length} holidays added` : "Holiday added"
  const repriceMessage = reprice.updated.length
    ? ` ${reprice.updated.length} upcoming leave request(s) recalculated.`
    : ""
  const reviewMessage = reprice.needsReview.length
    ? ` ${reprice.needsReview.length} request(s) now fall entirely on holidays and need manual review.`
    : ""

  return NextResponse.json({
    message: `${baseMessage}.${repriceMessage}${reviewMessage}`.trim(),
    leave_recalculated: reprice.updated,
    leave_needs_review: reprice.needsReview,
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await ensureAdmin(request)
  if ("error" in auth) return auth.error

  const holidayDate = String(request.nextUrl.searchParams.get("holiday_date") || "")
  const location = String(request.nextUrl.searchParams.get("location") || "all").trim() || "all"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
    return NextResponse.json({ error: "holiday_date is required" }, { status: 400 })
  }

  const dataClient = getServiceRoleClientOrFallback(auth.supabase)
  const { error } = await dataClient
    .from("holiday_calendar")
    .delete()
    .eq("holiday_date", holidayDate)
    .eq("location", location)
  if (error) return serverError(log, error)

  // Removing a holiday puts the day back on the clock for future leave.
  const reprice = await repriceLeaveForHolidayChange(dataClient, {
    fromDate: holidayDate,
    toDate: holidayDate,
    actorId: auth.userId,
    reason: "Holiday removed",
  })

  return NextResponse.json({
    message: reprice.updated.length
      ? `Holiday removed. ${reprice.updated.length} upcoming leave request(s) recalculated.`
      : "Holiday removed",
    leave_recalculated: reprice.updated,
  })
}
