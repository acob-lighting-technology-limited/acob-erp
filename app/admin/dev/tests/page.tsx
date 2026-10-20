import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DevTestsContent } from "./dev-tests-content"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

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

  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <DevTestsContent />
    </TablePageLayoutProvider>
  )
}
