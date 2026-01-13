import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get dashboard stats using the database function
    const { data: stats, error } = await supabase.rpc("get_starlink_dashboard_stats")

    if (error) {
      console.error("Error fetching starlink dashboard stats:", error)
      return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 })
    }

    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error("Error in GET /api/starlink/dashboard:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
