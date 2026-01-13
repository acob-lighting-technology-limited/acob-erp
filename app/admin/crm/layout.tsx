import { CRMSidebar } from "@/components/crm-sidebar"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Check if user has admin/lead access
  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen">
      <CRMSidebar user={user} profile={profile} />
      <main className="bg-background flex-1 overflow-auto">{children}</main>
    </div>
  )
}
