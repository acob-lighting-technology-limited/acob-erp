import { redirect } from "next/navigation"
import { BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { PageWrapper, PageHeader } from "@/components/layout"
import { KssWorkspace } from "@/app/admin/communications/_components/KssWorkspace"

export default async function CommunicationsMeetingsKssPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || !["developer", "super_admin", "admin"].includes(profile.role)) {
    redirect("/profile")
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Knowledge Sharing"
        description="Presenting department rotation and the heads-up email to the next department."
        icon={BookOpen}
        backLink={{ href: "/admin/communications/meetings", label: "Back" }}
      />
      <KssWorkspace />
    </PageWrapper>
  )
}
