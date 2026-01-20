import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Force dynamic rendering to allow cookies/auth
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id: employeeId } = await params

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get suspension history for the employee
    const { data: suspensions, error } = await supabase
      .from("employee_suspensions")
      .select(
        `
        id,
        reason,
        start_date,
        end_date,
        is_active,
        lifted_at,
        lift_reason,
        suspended_by,
        lifted_by,
        created_at
      `
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching suspensions:", error)
      return NextResponse.json({ error: "Failed to fetch suspension history" }, { status: 500 })
    }

    // Get names of users who suspended/lifted
    const userIds = new Set<string>()
    suspensions?.forEach((s) => {
      if (s.suspended_by) userIds.add(s.suspended_by)
      if (s.lifted_by) userIds.add(s.lifted_by)
    })

    const { data: users } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(userIds))

    const userMap = new Map(users?.map((u) => [u.id, `${u.first_name} ${u.last_name}`]) || [])

    // Enhance suspensions with user names
    const enhancedSuspensions = suspensions?.map((s) => ({
      ...s,
      suspended_by_name: s.suspended_by ? userMap.get(s.suspended_by) : null,
      lifted_by_name: s.lifted_by ? userMap.get(s.lifted_by) : null,
    }))

    return NextResponse.json({ suspensions: enhancedSuspensions })
  } catch (error) {
    console.error("Error fetching suspensions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
