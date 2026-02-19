import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MailDigestContent } from "./mail-digest-content"

export default async function MailDigestPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  // Fetch all active employees with their emails
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, company_email, department, employment_status")
    .not("company_email", "is", null)
    .order("full_name")

  const activeEmployees = (employees || []).filter((e: any) => e.employment_status === "active" || !e.employment_status)

  return <MailDigestContent employees={activeEmployees} />
}
