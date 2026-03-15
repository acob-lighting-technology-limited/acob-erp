import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger("admin-helper")

export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, admin_domains")
      .eq("id", userId)
      .single()

    if (error) {
      log.error({ err: error, userId }, "Error checking admin status")
      return false
    }

    const role = String(profile?.role ?? "").toLowerCase()
    if (role === "developer" || role === "super_admin") return true
    if (role !== "admin") return false
    const domains = Array.isArray(profile?.admin_domains) ? (profile.admin_domains as string[]) : []
    return domains.length > 0
  } catch (error) {
    log.error({ err: error, userId }, "Unexpected error checking admin status")
    return false
  }
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<boolean> {
  try {
    const supabase = await createClient()
    const payload = isAdmin
      ? { role: "admin", admin_domains: ["hr"] as string[] }
      : { role: "employee", admin_domains: null as string[] | null }
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId)

    if (error) {
      log.error({ err: error, userId }, "Error updating admin status")
      return false
    }

    return true
  } catch (error) {
    log.error({ err: error, userId }, "Unexpected error updating admin status")
    return false
  }
}
