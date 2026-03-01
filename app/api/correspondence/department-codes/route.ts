import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, isAdminRole } from "@/lib/correspondence/server"

export async function GET() {
  try {
    const { supabase, user } = await getAuthContext()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("correspondence_department_codes")
      .select("*")
      .order("department_name", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error("Error in GET /api/correspondence/department-codes:", error)
    return NextResponse.json({ error: "Failed to fetch department codes" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminRole(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const departmentName = String(body?.department_name || "").trim()
    const departmentCode = String(body?.department_code || "")
      .trim()
      .toUpperCase()
    const isActive = body?.is_active === false ? false : true

    if (!departmentName || !departmentCode) {
      return NextResponse.json({ error: "department_name and department_code are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("correspondence_department_codes")
      .upsert(
        {
          department_name: departmentName,
          department_code: departmentCode,
          is_active: isActive,
        },
        { onConflict: "department_name" }
      )
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Error in PATCH /api/correspondence/department-codes:", error)
    return NextResponse.json({ error: "Failed to update department code" }, { status: 500 })
  }
}
