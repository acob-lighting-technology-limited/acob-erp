import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch system settings without authentication
    const { data: settings } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["shutdown_mode", "maintenance_mode"])

    const shutdownMode = settings?.find((s) => s.setting_key === "shutdown_mode")?.setting_value || { enabled: false }
    const maintenanceMode = settings?.find((s) => s.setting_key === "maintenance_mode")?.setting_value || {
      enabled: false,
    }

    return NextResponse.json({
      shutdownMode,
      maintenanceMode,
    })
  } catch (error) {
    console.error("Error fetching system status:", error)
    // Return default values if error
    return NextResponse.json({
      shutdownMode: { enabled: false },
      maintenanceMode: { enabled: false },
    })
  }
}
