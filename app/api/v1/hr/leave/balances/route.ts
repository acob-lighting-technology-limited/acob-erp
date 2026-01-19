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

    const { data: balances, error } = await supabase
      .from("leave_balances")
      .select(
        `
        *,
        leave_type:leave_types!leave_balances_leave_type_id_fkey (
          id,
          name,
          description,
          max_days,
          requires_approval
        )
      `
      )
      .eq("user_id", userId)
      .order("leave_type_id")

    if (error) {
      console.error("Error fetching leave balances:", error)
      return NextResponse.json({ error: "Failed to fetch leave balances" }, { status: 500 })
    }

    return NextResponse.json({ data: balances })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/balances:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
