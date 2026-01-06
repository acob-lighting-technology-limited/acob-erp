import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user already clocked in today
    const today = new Date().toISOString().split("T")[0]
    const { data: existingRecord } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single()

    if (existingRecord) {
      return NextResponse.json({ error: "You have already clocked in today" }, { status: 400 })
    }

    // Create attendance record
    const { data: record, error } = await supabase
      .from("attendance_records")
      .insert({
        user_id: user.id,
        date: today,
        clock_in: new Date().toTimeString().split(" ")[0],
        status: "present",
      })
      .select()
      .single()

    if (error) {
      console.error("Error clocking in:", error)
      return NextResponse.json({ error: "Failed to clock in" }, { status: 500 })
    }

    return NextResponse.json({
      data: record,
      message: "Clocked in successfully",
    })
  } catch (error) {
    console.error("Error in POST /api/hr/attendance/clock-in:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
