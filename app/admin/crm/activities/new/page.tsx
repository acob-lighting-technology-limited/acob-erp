import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NewActivityContent } from "./new-activity-content"
import type { CRMContact } from "@/types/crm"

interface PageProps {
  searchParams: Promise<{ contact_id?: string }>
}

async function getNewActivityData(contactId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch contacts for dropdown
  const { data: contactsData } = await supabase
    .from("crm_contacts")
    .select("id, contact_name, company_name")
    .order("contact_name", { ascending: true })

  // Fetch pre-selected contact if provided
  let preselectedContact = null
  if (contactId) {
    const { data } = await supabase.from("crm_contacts").select("id, contact_name").eq("id", contactId).single()
    preselectedContact = data
  }

  return {
    contacts: (contactsData || []) as CRMContact[],
    preselectedContactId: contactId || null,
  }
}

export default async function NewActivityPage({ searchParams }: PageProps) {
  const { contact_id } = await searchParams
  const data = await getNewActivityData(contact_id)

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as { contacts: CRMContact[]; preselectedContactId: string | null }

  return <NewActivityContent initialContacts={pageData.contacts} preselectedContactId={pageData.preselectedContactId} />
}
