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

    const { data, error } = await supabase.from("approval_sla_policies").select("*").order("stage")

    if (error) return NextResponse.json({ error: "Failed to fetch SLA policies" }, { status: 500 })
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
      .from("approval_sla_policies")
      .upsert(payload, { onConflict: "stage" })
      .select()

    if (error) return NextResponse.json({ error: "Failed to save SLA policy" }, { status: 500 })
    return NextResponse.json({ data, message: "SLA policy saved" })
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
