import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!["admin", "super_admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    let query = supabase
      .from("leave_requests")
      .select(
        `
        id,
        user_id,
        leave_type_id,
        start_date,
        end_date,
        resume_date,
        days_count,
        status,
        approval_stage,
        approved_at,
        updated_at,
        user:profiles!leave_requests_user_id_fkey(id, full_name, company_email),
        leave_type:leave_types!leave_requests_leave_type_id_fkey(id, name, code)
      `
      )
      .in("status", ["approved", "cancelled"])
      .order("updated_at", { ascending: false })

    if (from) query = query.gte("start_date", from)
    if (to) query = query.lte("end_date", to)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch payroll leave feed" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/payroll-feed:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
