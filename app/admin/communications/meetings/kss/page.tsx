import { redirect } from "next/navigation"
import { BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { PageWrapper, PageHeader } from "@/components/layout"
import { KssRotationCard } from "@/app/admin/communications/_components/KssRotationCard"

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
        description="Who presents each week, and the heads-up email that tells them."
        icon={BookOpen}
        backLink={{ href: "/admin/communications/meetings", label: "Back" }}
      />
      <div className="max-w-3xl">
        <KssRotationCard />
      </div>
    </PageWrapper>
  )
}
