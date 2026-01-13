import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SettingsContent } from "./settings-content"

export interface SystemSettings {
  shutdown_mode?: {
    enabled: boolean
    title: string
    message: string
  }
  maintenance_mode?: {
    enabled: boolean
    title: string
    message: string
    estimated_end?: string | null
  }
}

async function getSettingsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Check if user is super_admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "super_admin") {
    return { redirect: "/admin" as const }
  }

  // Fetch system settings
  const { data: settingsData } = await supabase
    .from("system_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["shutdown_mode", "maintenance_mode"])

  const settings: SystemSettings = {
    shutdown_mode: {
      enabled: false,
      title: "Service Discontinued",
      message: "This service has been discontinued as of December 2, 2024.",
    },
    maintenance_mode: {
      enabled: false,
      title: "Maintenance Mode",
      message: "We are currently performing scheduled maintenance. Please check back soon.",
      estimated_end: null,
    },
  }

  if (settingsData) {
    settingsData.forEach((item) => {
      if (item.setting_key === "shutdown_mode" && item.setting_value) {
        settings.shutdown_mode = item.setting_value
      }
      if (item.setting_key === "maintenance_mode" && item.setting_value) {
        settings.maintenance_mode = item.setting_value
      }
    })
  }

  return { settings }
}

export default async function SettingsPage() {
  const data = await getSettingsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const settingsData = data as { settings: SystemSettings }

  return <SettingsContent initialSettings={settingsData.settings} />
}
