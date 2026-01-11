import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is super admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden - Super admin access required" }, { status: 403 })
    }

    // Fetch all system settings
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("*")
      .in("setting_key", ["shutdown_mode", "maintenance_mode"])

    if (error) {
      console.error("Error fetching system settings:", error)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    // Convert array to object for easier access
    const settingsObj =
      settings?.reduce(
        (acc, setting) => {
          acc[setting.setting_key] = setting.setting_value
          return acc
        },
        {} as Record<string, any>
      ) || {}

    return NextResponse.json(settingsObj)
  } catch (error) {
    console.error("Error in GET /api/system-settings:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is super admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden - Super admin access required" }, { status: 403 })
    }

    const { settingKey, settingValue } = await request.json()

    if (!settingKey || !settingValue) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate setting key
    if (!["shutdown_mode", "maintenance_mode"].includes(settingKey)) {
      return NextResponse.json({ error: "Invalid setting key" }, { status: 400 })
    }

    // Update the setting using the function
    const { error } = await supabase.rpc("update_system_setting", {
      key: settingKey,
      value: settingValue,
      user_id: user.id,
    })

    if (error) {
      console.error("Error updating system setting:", error)
      return NextResponse.json({ error: "Failed to update setting" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in POST /api/system-settings:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
