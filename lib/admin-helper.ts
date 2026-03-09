import { createClient } from "@/lib/supabase/server"

export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, admin_domains")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[v0] Error checking admin status:", error)
      return false
    }

    const role = String((profile as any)?.role || "").toLowerCase()
    if (role === "developer" || role === "super_admin") return true
    if (role !== "admin") return false
    const domains = Array.isArray((profile as any)?.admin_domains) ? (profile as any).admin_domains : []
    return domains.length > 0
  } catch (error) {
    console.error("[v0] Unexpected error checking admin status:", error)
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
      console.error("[v0] Error updating admin status:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] Unexpected error updating admin status:", error)
    return false
  }
}
