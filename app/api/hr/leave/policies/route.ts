import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function assertHR(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single()
  return ["admin", "super_admin"].includes(data?.role)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("leave_policies")
      .select("*, leave_type:leave_types!leave_policies_leave_type_id_fkey(id, name, code, max_days)")
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: "Failed to fetch leave policies" }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isHR = await assertHR(supabase, user.id)
    if (!isHR) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { data, error } = await supabase.from("leave_policies").upsert(body).select().single()

    if (error) return NextResponse.json({ error: "Failed to save leave policy" }, { status: 500 })
    return NextResponse.json({ data, message: "Leave policy saved" })
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
