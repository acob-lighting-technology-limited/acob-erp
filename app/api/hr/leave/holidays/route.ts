import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
const HolidayEntrySchema = z.record(z.unknown())
const SaveHolidaysSchema = z.union([HolidayEntrySchema, z.array(HolidayEntrySchema)])

async function assertHR(supabase: SupabaseServerClient, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single()
  return ["developer", "admin", "super_admin"].includes(data?.role)
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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isHR = await assertHR(supabase, user.id)
    if (!isHR) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const parsed = SaveHolidaysSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const payload = Array.isArray(parsed.data) ? parsed.data : [parsed.data]

    const { data, error } = await supabase
      .from("holiday_calendar")
      .upsert(payload, { onConflict: "holiday_date,location" })
      .select()

    if (error) return NextResponse.json({ error: "Failed to save holidays" }, { status: 500 })

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "holiday",
        entityId: Array.isArray(data) && data[0]?.id ? data[0].id : "bulk",
        newValues: { count: Array.isArray(data) ? data.length : 1 },
        context: { actorId: user.id, source: "api", route: "/api/hr/leave/holidays" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data, message: "Holidays saved" })
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export async function POST(request: NextRequest) {
  return PATCH(request)
}
