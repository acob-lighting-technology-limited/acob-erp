import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignatureCreator } from "@/components/signature-creator"

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
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-8">
          <h1 className="text-foreground text-3xl font-bold">Email Signature Creator</h1>
          <p className="text-muted-foreground">Generate your professional email signature</p>
        </div>

        <SignatureCreator profile={profile} />
      </div>
    </div>
  )
}
