import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("v1-hr-attendance-clock-out")

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get today's attendance record
    const today = new Date().toISOString().split("T")[0]
    const { data: record } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single()

    if (!record) {
      return NextResponse.json({ error: "No clock-in record found for today" }, { status: 404 })
    }

    if (record.clock_out) {
      return NextResponse.json({ error: "You have already clocked out today" }, { status: 400 })
    }

    const clockOutTime = new Date().toTimeString().split(" ")[0]

    // Calculate total hours
    const clockIn = new Date(`${today}T${record.clock_in}`)
    const clockOut = new Date(`${today}T${clockOutTime}`)
    const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
    const breakDuration = record.break_duration || 0
    const workHours = totalHours - breakDuration / 60

    // Update attendance record
    const { data: updatedRecord, error } = await supabase
      .from("attendance_records")
      .update({
        clock_out: clockOutTime,
        total_hours: workHours,
      })
      .eq("id", record.id)
      .select()
      .single()

    if (error) {
      log.error({ err: String(error) }, "Error clocking out:")
      return NextResponse.json({ error: "Failed to clock out" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "attendance_record",
        entityId: record.id,
        newValues: { clock_out: clockOutTime, total_hours: workHours },
        context: { actorId: user.id, source: "api", route: "/api/v1/hr/attendance/clock-out" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      data: updatedRecord,
      message: "Clocked out successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/hr/attendance/clock-out:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
