import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function assertHR(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single()
  return ["admin", "super_admin"].includes(data?.role)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location") || null

    let query = supabase.from("holiday_calendar").select("*").order("holiday_date", { ascending: true })
    if (location) query = query.eq("location", location)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch {
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
    const payload = Array.isArray(body) ? body : [body]

    const { data, error } = await supabase
      .from("holiday_calendar")
      .upsert(payload, { onConflict: "holiday_date,location" })
      .select()

    if (error) return NextResponse.json({ error: "Failed to save holidays" }, { status: 500 })
    return NextResponse.json({ data, message: "Holidays saved" })
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
