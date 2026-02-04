import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignatureCreator } from "@/components/signature-creator"
import { PageHeader, PageWrapper } from "@/components/layout"
import { FileSignature } from "lucide-react"

export default async function SignaturePage({ searchParams }: { searchParams: { userId?: string } }) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // If admin and userId specified, allow viewing that user's signature
  let targetUserId = data.user.id
  if (searchParams?.userId) {
    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single()
    if (me?.is_admin) {
      targetUserId = searchParams.userId
    }
  }

  // Fetch user profile for auto-population
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", targetUserId).single()

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Email Signature Creator"
        description="Generate your professional email signature"
        icon={FileSignature}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />
      <SignatureCreator profile={profile} />
    </PageWrapper>
  )
}
