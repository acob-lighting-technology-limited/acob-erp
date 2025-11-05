import type { Metadata } from "next"
import { Sidebar } from "@/components/sidebar"
import { SidebarContent } from "@/components/sidebar-content"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Dashboard | ACOB Lighting Technology Limited",
  description: "View your personal dashboard, stats, and activities at ACOB Lighting Technology Limited",
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single()

  const userData = {
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={userData} profile={profile || undefined} isAdmin={profile?.is_admin === true} />
      <SidebarContent>{children}</SidebarContent>
    </div>
  )
}
