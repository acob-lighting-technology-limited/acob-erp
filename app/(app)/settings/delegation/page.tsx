import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { EditAccessManager } from "@/components/admin/edit-access-manager"
import { loadDelegableRoutes } from "@/lib/admin/delegable-routes"

export const dynamic = "force-dynamic"

export default async function SettingsDelegationPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect("/auth/login")

  const routes = await loadDelegableRoutes(supabase, user.id)
  if (routes.length === 0) redirect("/settings/profile")

  return <EditAccessManager mode="delegate" routes={routes} emptyText="You have not delegated anything" />
}
