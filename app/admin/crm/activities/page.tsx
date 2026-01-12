import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ActivitiesContent } from "./activities-content"
import type { CRMActivity } from "@/types/crm"

async function getActivitiesData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch initial activities
  const { data: activitiesData, count } = await supabase
    .from("crm_activities")
    .select("*, contact:crm_contacts(id, contact_name, company_name)", { count: "exact" })
    .order("due_date", { ascending: true })
    .limit(50)

  return {
    activities: (activitiesData || []) as CRMActivity[],
    totalCount: count || 0,
  }
}

export default async function ActivitiesPage() {
  const data = await getActivitiesData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    activities: CRMActivity[]
    totalCount: number
  }

  return <ActivitiesContent initialActivities={pageData.activities} initialTotalCount={pageData.totalCount} />
}
