import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OpportunitiesContent } from "./opportunities-content"
import type { CRMOpportunity, CRMPipeline } from "@/types/crm"

async function getOpportunitiesData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch pipeline
  const { data: pipelinesData } = await supabase
    .from("crm_pipelines")
    .select("*")
    .order("is_default", { ascending: false })
    .limit(1)

  const pipeline = pipelinesData?.[0] || null

  // Fetch open opportunities
  const { data: opportunitiesData } = await supabase
    .from("crm_opportunities")
    .select("*, contact:crm_contacts(id, contact_name, company_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })

  return {
    opportunities: (opportunitiesData || []) as CRMOpportunity[],
    pipeline: pipeline as CRMPipeline | null,
  }
}

export default async function OpportunitiesPage() {
  const data = await getOpportunitiesData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    opportunities: CRMOpportunity[]
    pipeline: CRMPipeline | null
  }

  return <OpportunitiesContent initialOpportunities={pageData.opportunities} initialPipeline={pageData.pipeline} />
}
