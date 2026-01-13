import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NewOpportunityContent } from "./new-opportunity-content"
import type { CRMContact, CRMPipeline } from "@/types/crm"

interface PageProps {
  searchParams: Promise<{ contact_id?: string }>
}

async function getNewOpportunityData(contactId?: string) {
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

  // Fetch pipeline
  const { data: pipelinesData } = await supabase
    .from("crm_pipelines")
    .select("*")
    .order("is_default", { ascending: false })
    .limit(1)

  return {
    contacts: (contactsData || []) as CRMContact[],
    pipeline: pipelinesData?.[0] || null,
    preselectedContactId: contactId || null,
  }
}

export default async function NewOpportunityPage({ searchParams }: PageProps) {
  const { contact_id } = await searchParams
  const data = await getNewOpportunityData(contact_id)

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as { contacts: CRMContact[]; pipeline: CRMPipeline | null; preselectedContactId: string | null }

  return (
    <NewOpportunityContent
      initialContacts={pageData.contacts}
      initialPipeline={pageData.pipeline}
      preselectedContactId={pageData.preselectedContactId}
    />
  )
}
