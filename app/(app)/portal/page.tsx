import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function PortalPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Redirect to profile page - this is the portal home
  redirect("/portal/profile")
}
