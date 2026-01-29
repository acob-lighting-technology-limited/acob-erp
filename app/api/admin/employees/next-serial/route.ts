import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/client"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Call the database function to get the next serial
    const { data, error } = await supabase.rpc("get_next_employee_serial")

    if (error) {
      console.error("Error fetching next serial:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ serial: data })
  } catch (error) {
    console.error("Internal error fetching next serial:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
