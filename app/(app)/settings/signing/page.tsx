import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SigningSetup } from "@/components/approval-signing/signing-setup"

export default async function SettingsSigningPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  return <SigningSetup />
}
