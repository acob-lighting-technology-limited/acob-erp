import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase/server"
import { PageHeader, PageWrapper } from "@/components/layout"
import { loadDelegableRoutes } from "@/lib/admin/delegable-routes"
import { SettingsNav } from "./_components/settings-nav"
import { Settings } from "lucide-react"

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  // The Delegation tab is only for people who hold edit access they can hand on.
  let showDelegation = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) showDelegation = (await loadDelegableRoutes(supabase, user.id)).length > 0
  } catch {
    showDelegation = false
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Settings"
        description="Manage your profile, security, signing and notification preferences."
        icon={Settings}
        backLink={{ href: "/profile", label: "Back to Home" }}
      />
      <SettingsNav showDelegation={showDelegation} />
      <div className="pt-2">{children}</div>
    </PageWrapper>
  )
}
