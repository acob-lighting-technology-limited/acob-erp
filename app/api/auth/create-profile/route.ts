import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).single()

    if (existingProfile) {
      return NextResponse.json({ message: "Profile already exists" }, { status: 200 })
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      company_email: user.email,
      first_name: "",
      last_name: "",
      other_names: "",
      department: "",
      company_role: "",
      phone_number: "",
      additional_phone: "",
      residential_address: "",
      current_work_location: "",
      site_name: "",
      site_state: "",
      device_allocated: "",
      device_type: "",
      device_model: "",
      is_admin: false,
    })

    if (insertError) {
      console.error("[v0] Profile creation error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ message: "Profile created successfully" }, { status: 201 })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
