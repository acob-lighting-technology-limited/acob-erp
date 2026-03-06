import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DevTestsContent } from "./dev-tests-content"

export const metadata = {
  title: "Developer Tests | DEV Control Plane",
}

export default async function DevTestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "developer") redirect("/admin/dev")

  return <DevTestsContent />
}
