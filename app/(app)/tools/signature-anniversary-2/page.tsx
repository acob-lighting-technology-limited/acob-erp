import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignatureCreatorAnniversaryV2 } from "@/components/signature-creator-anniversary-v2"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Sparkles } from "lucide-react"

export default async function AnniversarySignatureV2Page({ searchParams }: { searchParams: { userId?: string } }) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  let targetUserId = data.user.id
  if (searchParams?.userId) {
    const scope = await resolveAdminScope(supabase, data.user.id)
    if (scope) {
      targetUserId = searchParams.userId
    }
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", targetUserId).single()

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="10th Anniversary Signature V2"
        description="Generate the premium anniversary email signature with elevated design"
        icon={Sparkles}
        backLink={{ href: "/tools", label: "Back to Tools" }}
      />
      <SignatureCreatorAnniversaryV2 profile={profile} />
    </PageWrapper>
  )
}
