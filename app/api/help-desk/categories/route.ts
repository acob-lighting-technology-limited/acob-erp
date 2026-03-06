import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("help_desk_categories")
      .select("id, service_department, request_type, code, name, description, support_mode, is_active")
      .eq("is_active", true)
      .order("service_department")
      .order("name")

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error("Error in GET /api/help-desk/categories:", error)
    return NextResponse.json({ error: "Failed to fetch help desk categories" }, { status: 500 })
  }
}
