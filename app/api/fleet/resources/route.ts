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
      .from("fleet_resources")
      .select("id, name, resource_type, description, is_active")
      .eq("is_active", true)
      .order("name")

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to fetch fleet resources" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
