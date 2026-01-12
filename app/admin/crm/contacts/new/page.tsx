import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NewContactContent } from "./new-contact-content"

async function getNewContactData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch staff for assignment dropdown
  const { data: staffData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true })

  return {
    staff: staffData || [],
  }
}

export default async function NewContactPage() {
  const data = await getNewContactData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as { staff: { id: string; first_name: string; last_name: string }[] }

  return <NewContactContent initialStaff={pageData.staff} />
}
