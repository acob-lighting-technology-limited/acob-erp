import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ContactsContent } from "./contacts-content"
import type { CRMContact } from "@/types/crm"

async function getContactsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch initial contacts (first page)
  const limit = 20
  const { data: contactsData, count } = await supabase
    .from("crm_contacts")
    .select("*, assigned_user:profiles!crm_contacts_assigned_to_fkey(first_name, last_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(0, limit - 1)

  return {
    contacts: (contactsData || []) as CRMContact[],
    totalCount: count || 0,
  }
}

export default async function ContactsPage() {
  const data = await getContactsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    contacts: CRMContact[]
    totalCount: number
  }

  return <ContactsContent initialContacts={pageData.contacts} initialTotalCount={pageData.totalCount} />
}
