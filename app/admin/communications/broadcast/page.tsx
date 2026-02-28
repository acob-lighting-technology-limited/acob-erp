import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CommunicationsComposer } from "@/app/admin/communications/_components/communications-composer"

export default async function CommunicationsBroadcastPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, department")
    .eq("id", user.id)
    .single()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, company_email, additional_email, department, employment_status")
    .eq("employment_status", "active")
    .or("company_email.not.is.null,additional_email.not.is.null")
    .order("full_name")

  return (
    <CommunicationsComposer
      employees={employees || []}
      mode="communications"
      currentUser={{
        id: user.id,
        full_name: profile?.full_name || null,
        department: profile?.department || null,
      }}
    />
  )
}
