import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import type { SurveyMetrics, SystemSatisfactionSurvey } from "@/types/survey"

export const dynamic = "force-dynamic"

const log = logger("admin-surveys-api")

export interface AdminSurveyItem extends SystemSatisfactionSurvey {
  respondent_name?: string | null
  respondent_email?: string | null
}

export async function GET() {
  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { supabase } = scopeResult
    const db = getServiceRoleClientOrFallback(supabase)

    const { data: surveys, error } = await db
      .from("system_satisfaction_surveys")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      log.error({ err: String(error) }, "Failed to fetch survey responses")
      return NextResponse.json({ error: "Failed to fetch surveys" }, { status: 500 })
    }

    const surveyRows = (surveys || []) as SystemSatisfactionSurvey[]

    // Fetch profile info only for non-anonymous rows
    const nonAnonUserIds = Array.from(
      new Set(surveyRows.filter((s) => !s.is_anonymous && s.user_id).map((s) => s.user_id as string))
    )

    const profilesMap = new Map<string, { name: string; email: string }>()
    if (nonAnonUserIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", nonAnonUserIds)

      for (const p of profiles || []) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Employee"
        profilesMap.set(p.id, { name, email: p.email || "" })
      }
    }

    const items: AdminSurveyItem[] = surveyRows.map((s) => {
      if (s.is_anonymous || !s.user_id) {
        return {
          ...s,
          user_id: null,
          respondent_name: "Anonymous Employee",
          respondent_email: null,
        }
      }
      const profile = profilesMap.get(s.user_id)
      return {
        ...s,
        respondent_name: profile?.name || "Employee",
        respondent_email: profile?.email || null,
      }
    })

    // Calculate aggregate metrics
    const total = items.length
    let sumOverall = 0
    let sumSpeed = 0
    let sumUsability = 0
    const moduleMap: Record<string, { total: number; count: number }> = {}
    const trainingDist = { adequate: 0, somewhat: 0, inadequate: 0 }
    const deptCounts: Record<string, number> = {}

    for (const item of items) {
      sumOverall += item.overall_rating
      sumSpeed += item.speed_rating
      sumUsability += item.usability_rating

      if (item.department) {
        deptCounts[item.department] = (deptCounts[item.department] || 0) + 1
      }

      if (item.training_rating && item.training_rating in trainingDist) {
        trainingDist[item.training_rating as keyof typeof trainingDist]++
      }

      if (item.module_ratings && typeof item.module_ratings === "object") {
        for (const [mod, rating] of Object.entries(item.module_ratings)) {
          if (typeof rating === "number") {
            if (!moduleMap[mod]) moduleMap[mod] = { total: 0, count: 0 }
            moduleMap[mod].total += rating
            moduleMap[mod].count += 1
          }
        }
      }
    }

    const moduleAverages: Record<string, { avg: number; count: number }> = {}
    for (const [mod, data] of Object.entries(moduleMap)) {
      moduleAverages[mod] = {
        avg: data.count > 0 ? Number((data.total / data.count).toFixed(1)) : 0,
        count: data.count,
      }
    }

    const metrics: SurveyMetrics = {
      totalResponses: total,
      averageOverall: total > 0 ? Number((sumOverall / total).toFixed(1)) : 0,
      averageSpeed: total > 0 ? Number((sumSpeed / total).toFixed(1)) : 0,
      averageUsability: total > 0 ? Number((sumUsability / total).toFixed(1)) : 0,
      moduleAverages,
      trainingDistribution: trainingDist,
      departmentCounts: deptCounts,
    }

    return NextResponse.json({ data: items, metrics })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled admin surveys GET error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
