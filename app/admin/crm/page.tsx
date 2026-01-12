import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CRMDashboardContent, type DashboardMetrics, type PipelineStage } from "./crm-dashboard-content"

async function getCRMDashboardData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Initialize metrics
  const metrics: DashboardMetrics = {
    total_contacts: 0,
    leads_count: 0,
    customers_count: 0,
    open_opportunities: 0,
    total_pipeline_value: 0,
    weighted_pipeline_value: 0,
    won_this_month: 0,
    won_value_this_month: 0,
    activities_due_today: 0,
    overdue_activities: 0,
    conversion_rate: 0,
  }

  try {
    // Get contact counts
    const { count: totalContacts } = await supabase.from("crm_contacts").select("*", { count: "exact", head: true })

    const { count: leadsCount } = await supabase
      .from("crm_contacts")
      .select("*", { count: "exact", head: true })
      .eq("contact_type", "lead")

    const { count: customersCount } = await supabase
      .from("crm_contacts")
      .select("*", { count: "exact", head: true })
      .eq("contact_type", "customer")

    metrics.total_contacts = totalContacts || 0
    metrics.leads_count = leadsCount || 0
    metrics.customers_count = customersCount || 0

    // Calculate conversion rate
    if (metrics.total_contacts > 0) {
      metrics.conversion_rate = Math.round((metrics.customers_count / metrics.total_contacts) * 100)
    }

    // Get opportunity metrics
    const { data: opportunities } = await supabase
      .from("crm_opportunities")
      .select("stage, expected_value, probability")
      .not("stage", "in", '("closed_won","closed_lost")')

    if (opportunities) {
      metrics.open_opportunities = opportunities.length
      metrics.total_pipeline_value = opportunities.reduce((sum, o) => sum + (o.expected_value || 0), 0)
      metrics.weighted_pipeline_value = opportunities.reduce(
        (sum, o) => sum + ((o.expected_value || 0) * (o.probability || 0)) / 100,
        0
      )
    }

    // Get won deals this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: wonDeals } = await supabase
      .from("crm_opportunities")
      .select("expected_value")
      .eq("stage", "closed_won")
      .gte("closed_at", startOfMonth.toISOString())

    if (wonDeals) {
      metrics.won_this_month = wonDeals.length
      metrics.won_value_this_month = wonDeals.reduce((sum, d) => sum + (d.expected_value || 0), 0)
    }

    // Get activity metrics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { count: dueToday } = await supabase
      .from("crm_activities")
      .select("*", { count: "exact", head: true })
      .eq("completed", false)
      .gte("due_date", today.toISOString())
      .lt("due_date", tomorrow.toISOString())

    const { count: overdue } = await supabase
      .from("crm_activities")
      .select("*", { count: "exact", head: true })
      .eq("completed", false)
      .lt("due_date", today.toISOString())

    metrics.activities_due_today = dueToday || 0
    metrics.overdue_activities = overdue || 0
  } catch (error) {
    console.error("Error fetching metrics:", error)
  }

  // Get pipeline by stage
  let pipelineByStage: Record<string, PipelineStage> = {}
  try {
    const { data: allOpportunities } = await supabase.from("crm_opportunities").select("stage, expected_value")

    if (allOpportunities) {
      pipelineByStage = allOpportunities.reduce(
        (acc, opp) => {
          const stage = opp.stage || "Unknown"
          if (!acc[stage]) {
            acc[stage] = { count: 0, value: 0 }
          }
          acc[stage].count++
          acc[stage].value += opp.expected_value || 0
          return acc
        },
        {} as Record<string, PipelineStage>
      )
    }
  } catch (error) {
    console.error("Error fetching pipeline:", error)
  }

  // Get recent activities
  let recentActivities: any[] = []
  try {
    const { data } = await supabase
      .from("crm_activities")
      .select("id, subject, type, priority, completed, due_date, contact:crm_contacts(contact_name)")
      .order("due_date", { ascending: true })
      .limit(5)

    recentActivities = data || []
  } catch (error) {
    console.error("Error fetching activities:", error)
  }

  // Get upcoming follow-ups
  let upcomingFollowUps: any[] = []
  try {
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, contact_name, company_name, next_follow_up")
      .not("next_follow_up", "is", null)
      .gte("next_follow_up", new Date().toISOString())
      .order("next_follow_up", { ascending: true })
      .limit(5)

    upcomingFollowUps = data || []
  } catch (error) {
    console.error("Error fetching follow-ups:", error)
  }

  return { metrics, pipelineByStage, recentActivities, upcomingFollowUps }
}

export default async function CRMDashboardPage() {
  const data = await getCRMDashboardData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    metrics: DashboardMetrics
    pipelineByStage: Record<string, PipelineStage>
    recentActivities: any[]
    upcomingFollowUps: any[]
  }

  return (
    <CRMDashboardContent
      initialMetrics={pageData.metrics}
      initialPipelineByStage={pageData.pipelineByStage}
      initialRecentActivities={pageData.recentActivities}
      initialUpcomingFollowUps={pageData.upcomingFollowUps}
    />
  )
}
