import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ContactDetailContent } from "./contact-detail-content"
import type { CRMContact, CRMOpportunity, CRMActivity } from "@/types/crm"

interface PageProps {
  params: Promise<{ id: string }>
}

async function getContactData(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch contact with related data
  const { data: contact, error } = await supabase
    .from("crm_contacts")
    .select("*, assigned_user:profiles!crm_contacts_assigned_to_fkey(first_name, last_name)")
    .eq("id", id)
    .single()

  if (error || !contact) {
    return { notFound: true as const }
  }

  // Fetch opportunities for this contact
  const { data: opportunities } = await supabase
    .from("crm_opportunities")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: false })

  // Fetch activities for this contact
  const { data: activities } = await supabase
    .from("crm_activities")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: false })

  return {
    contact: {
      ...contact,
      opportunities: opportunities || [],
      activities: activities || [],
    } as CRMContact & { opportunities: CRMOpportunity[]; activities: CRMActivity[] },
  }
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params
  const data = await getContactData(id)

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  if ("notFound" in data && data.notFound) {
    notFound()
  }

  const pageData = data as {
    contact: CRMContact & { opportunities: CRMOpportunity[]; activities: CRMActivity[] }
  }

  return <ContactDetailContent initialContact={pageData.contact} />
}
