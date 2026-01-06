import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
    const today = now.toISOString().split("T")[0]

    // Get all metrics in parallel
    const [
      contactsResult,
      leadsResult,
      customersResult,
      openOpportunitiesResult,
      pipelineValueResult,
      wonThisMonthResult,
      activitiesDueTodayResult,
      overdueActivitiesResult,
    ] = await Promise.all([
      // Total contacts
      supabase.from("crm_contacts").select("*", { count: "exact", head: true }),

      // Leads count
      supabase.from("crm_contacts").select("*", { count: "exact", head: true }).eq("type", "lead"),

      // Customers count
      supabase.from("crm_contacts").select("*", { count: "exact", head: true }).eq("type", "customer"),

      // Open opportunities
      supabase.from("crm_opportunities").select("*", { count: "exact", head: true }).eq("status", "open"),

      // Pipeline value (sum of open opportunities)
      supabase.from("crm_opportunities").select("value, probability, weighted_value").eq("status", "open"),

      // Won this month
      supabase
        .from("crm_opportunities")
        .select("value")
        .eq("status", "won")
        .gte("won_date", startOfMonth)
        .lte("won_date", endOfMonth),

      // Activities due today
      supabase
        .from("crm_activities")
        .select("*", { count: "exact", head: true })
        .eq("completed", false)
        .eq("due_date", today),

      // Overdue activities
      supabase
        .from("crm_activities")
        .select("*", { count: "exact", head: true })
        .eq("completed", false)
        .lt("due_date", today),
    ])

    // Calculate totals
    const totalPipelineValue = pipelineValueResult.data?.reduce((sum, opp) => sum + (opp.value || 0), 0) || 0
    const weightedPipelineValue =
      pipelineValueResult.data?.reduce((sum, opp) => sum + (opp.weighted_value || 0), 0) || 0
    const wonValueThisMonth = wonThisMonthResult.data?.reduce((sum, opp) => sum + (opp.value || 0), 0) || 0

    // Calculate conversion rate (leads converted to customers this month)
    const { count: convertedCount } = await supabase
      .from("crm_contacts")
      .select("*", { count: "exact", head: true })
      .eq("type", "customer")
      .gte("converted_to_customer_at", startOfMonth)
      .lte("converted_to_customer_at", endOfMonth)

    const leadsCount = leadsResult.count || 0
    const conversionRate = leadsCount > 0 ? Math.round(((convertedCount || 0) / leadsCount) * 100) : 0

    const metrics = {
      total_contacts: contactsResult.count || 0,
      leads_count: leadsCount,
      customers_count: customersResult.count || 0,
      open_opportunities: openOpportunitiesResult.count || 0,
      total_pipeline_value: totalPipelineValue,
      weighted_pipeline_value: weightedPipelineValue,
      won_this_month: wonThisMonthResult.data?.length || 0,
      won_value_this_month: wonValueThisMonth,
      activities_due_today: activitiesDueTodayResult.count || 0,
      overdue_activities: overdueActivitiesResult.count || 0,
      conversion_rate: conversionRate,
    }

    // Get pipeline breakdown by stage
    const { data: opportunities } = await supabase
      .from("crm_opportunities")
      .select("stage, status, value")
      .eq("status", "open")

    const pipelineByStage =
      opportunities?.reduce(
        (acc, opp) => {
          const stage = opp.stage || "Unknown"
          if (!acc[stage]) {
            acc[stage] = { count: 0, value: 0 }
          }
          acc[stage].count++
          acc[stage].value += opp.value || 0
          return acc
        },
        {} as Record<string, { count: number; value: number }>
      ) || {}

    // Get recent activities
    const { data: recentActivities } = await supabase
      .from("crm_activities")
      .select(
        `
        id, type, subject, due_date, completed, priority,
        contact:crm_contacts (id, contact_name, company_name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(5)

    // Get upcoming follow-ups
    const { data: upcomingFollowUps } = await supabase
      .from("crm_contacts")
      .select("id, contact_name, company_name, next_follow_up")
      .not("next_follow_up", "is", null)
      .gte("next_follow_up", today)
      .order("next_follow_up", { ascending: true })
      .limit(5)

    return NextResponse.json({
      metrics,
      pipelineByStage,
      recentActivities: recentActivities || [],
      upcomingFollowUps: upcomingFollowUps || [],
    })
  } catch (error: any) {
    console.error("Error in GET /api/crm/dashboard:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
