import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SigningSetup } from "@/components/approval-signing/signing-setup"

/** Only an in-app path: a full URL or protocol-relative "//host" here would be an open redirect. */
function safeReturnPath(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value
  return path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : undefined
}

export default async function SettingsSigningPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  return <SigningSetup returnTo={safeReturnPath((await searchParams).return)} />
}
