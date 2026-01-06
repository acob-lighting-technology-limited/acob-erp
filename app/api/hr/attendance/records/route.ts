import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id") || user.id
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    let query = supabase
      .from("attendance_records")
      .select(
        `
        *,
        user:profiles!attendance_records_user_id_fkey (
          id,
          first_name,
          last_name,
          full_name,
          company_email
        )
      `
      )
      .eq("user_id", userId)
      .order("date", { ascending: false })

    if (startDate) {
      query = query.gte("date", startDate)
    }

    if (endDate) {
      query = query.lte("date", endDate)
    }

    const { data: records, error } = await query

    if (error) {
      console.error("Error fetching attendance records:", error)
      return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 })
    }

    return NextResponse.json({ data: records })
  } catch (error) {
    console.error("Error in GET /api/hr/attendance/records:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
