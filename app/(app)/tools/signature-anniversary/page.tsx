import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignatureCreator } from "@/components/signature-creator"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { PageHeader, PageWrapper } from "@/components/layout"
import { FileSignature } from "lucide-react"

export default async function AnniversarySignaturePage(props: { searchParams: Promise<{ userId?: string }> }) {
  const searchParams = await props.searchParams
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
        title="10th Anniversary Signature Creator"
        description="Generate the temporary anniversary version of your email signature"
        icon={FileSignature}
        backLink={{ href: "/tools", label: "Back to Tools" }}
      />
      <SignatureCreator profile={profile} authEmail={data.user.email} variant="anniversary" />
    </PageWrapper>
  )
}
