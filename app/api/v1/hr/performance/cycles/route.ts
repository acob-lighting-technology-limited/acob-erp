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

    const { data: cycles, error } = await supabase
      .from("review_cycles")
      .select("*")
      .order("start_date", { ascending: false })

    if (error) {
      console.error("Error fetching review cycles:", error)
      return NextResponse.json({ error: "Failed to fetch review cycles" }, { status: 500 })
    }

    return NextResponse.json({ data: cycles })
  } catch (error) {
    console.error("Error in GET /api/hr/performance/cycles:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
