import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReportsContent, type ReportsData } from "./reports-content"

async function getReportsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get date ranges
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  // Fetch various report metrics
  const [contactsThisMonth, contactsLastMonth, opportunitiesWon, opportunitiesLost, totalPipeline] = await Promise.all([
    supabase
      .from("crm_contacts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString()),
    supabase
      .from("crm_contacts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfLastMonth.toISOString())
      .lt("created_at", startOfMonth.toISOString()),
    supabase
      .from("crm_opportunities")
      .select("id, expected_value")
      .eq("status", "won")
      .gte("closed_at", startOfMonth.toISOString()),
    supabase
      .from("crm_opportunities")
      .select("id, expected_value")
      .eq("status", "lost")
      .gte("closed_at", startOfMonth.toISOString()),
    supabase.from("crm_opportunities").select("id, expected_value").eq("status", "open"),
  ])

  const reportsData: ReportsData = {
    contactsThisMonth: contactsThisMonth.count || 0,
    contactsLastMonth: contactsLastMonth.count || 0,
    opportunitiesWonCount: opportunitiesWon.data?.length || 0,
    opportunitiesWonValue: opportunitiesWon.data?.reduce((sum, o) => sum + (o.expected_value || 0), 0) || 0,
    opportunitiesLostCount: opportunitiesLost.data?.length || 0,
    opportunitiesLostValue: opportunitiesLost.data?.reduce((sum, o) => sum + (o.expected_value || 0), 0) || 0,
    totalPipelineCount: totalPipeline.data?.length || 0,
    totalPipelineValue: totalPipeline.data?.reduce((sum, o) => sum + (o.expected_value || 0), 0) || 0,
  }

  return { reportsData }
}

export default async function ReportsPage() {
  const data = await getReportsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as { reportsData: ReportsData }

  return <ReportsContent initialData={pageData.reportsData} />
}
