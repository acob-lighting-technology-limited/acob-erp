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

    const { data: leaveTypes, error } = await supabase.from("leave_types").select("*").order("name")

    if (error) {
      console.error("Error fetching leave types:", error)
      return NextResponse.json({ error: "Failed to fetch leave types" }, { status: 500 })
    }

    return NextResponse.json({ data: leaveTypes })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/types:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
