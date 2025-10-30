import { createClient } from "@/lib/supabase/server"

export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: profile, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).single()

    if (error) {
      console.error("[v0] Error checking admin status:", error)
      return false
    }

    return profile?.is_admin === true
  } catch (error) {
    console.error("[v0] Unexpected error checking admin status:", error)
    return false
  }
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", userId)

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
