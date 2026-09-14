import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { logger } from "@/lib/logger"

const log = logger("corporate-services:risk-register")

const CreateRiskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(500),
  description: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  category: z
    .enum(["operational", "financial", "strategic", "compliance", "technical", "reputational", "health_safety"])
    .default("operational"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  likelihood: z.number().int().min(1).max(5).default(2),
  impact: z.number().int().min(1).max(5).default(2),
  mitigation_plan: z.string().optional().nullable(),
  contingency_plan: z.string().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  status: z.enum(["open", "mitigating", "resolved", "closed"]).default("open"),
  week_number: z.number().int().optional().nullable(),
  year: z.number().int().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const departmentParam = searchParams.get("department")
    const severityParam = searchParams.get("severity")
    const statusParam = searchParams.get("status")
    const categoryParam = searchParams.get("category")
    const searchParam = searchParams.get("q")

    const scopedDepts = getScopedDepartments(scope)
    const supabase = await createClient()

    let query = supabase
      .from("risk_register")
      .select(
        `
        id,
        title,
        description,
        department,
        week_number,
        year,
        category,
        severity,
        likelihood,
        impact,
        risk_score,
        mitigation_plan,
        contingency_plan,
        owner_id,
        status,
        report_id,
        position,
        created_by,
        created_at,
        updated_at,
        profiles:owner_id (
          id,
          first_name,
          last_name,
          email
        )
      `
      )
      .order("created_at", { ascending: false })

    // Department-level scoping
    if (scopedDepts !== null) {
      if (scopedDepts.length === 0) {
        return NextResponse.json({ data: [] })
      }
      query = query.in("department", scopedDepts)
    }

    if (departmentParam && departmentParam !== "all") {
      query = query.eq("department", departmentParam)
    }
    if (severityParam && severityParam !== "all") {
      query = query.eq("severity", severityParam)
    }
    if (statusParam && statusParam !== "all") {
      query = query.eq("status", statusParam)
    }
    if (categoryParam && categoryParam !== "all") {
      query = query.eq("category", categoryParam)
    }
    if (searchParam && searchParam.trim()) {
      query = query.ilike("title", `%${searchParam.trim()}%`)
    }

    const { data, error } = await query

    // If risk_register has persisted data, return it
    if (!error && data && data.length > 0) {
      return NextResponse.json({ data })
    }

    // Fallback: Read submitted weekly reports directly so all departmental challenges appear live!
    let wrQuery = supabase
      .from("weekly_reports")
      .select(
        `
        id,
        department,
        week_number,
        year,
        challenges,
        user_id,
        created_at,
        profiles:user_id (
          id,
          first_name,
          last_name,
          email
        )
      `
      )
      .eq("status", "submitted")
      .not("challenges", "is", null)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })

    if (scopedDepts !== null) {
      if (scopedDepts.length === 0) {
        return NextResponse.json({ data: [] })
      }
      wrQuery = wrQuery.in("department", scopedDepts)
    }

    if (departmentParam && departmentParam !== "all") {
      wrQuery = wrQuery.eq("department", departmentParam)
    }

    const { data: wrData, error: wrError } = await wrQuery

    if (wrError) {
      log.error({ err: wrError.message }, "Fallback weekly_reports fetch failed")
      return NextResponse.json({ data: [] })
    }

    type ProfileShape = { id: string; first_name: string | null; last_name: string | null; email: string | null }
    type FallbackReportRow = {
      id: string
      department: string | null
      week_number: number | null
      year: number | null
      challenges: string | null
      user_id: string | null
      created_at: string
      profiles: ProfileShape | ProfileShape[] | null
    }

    const fallbackRisks: Array<{
      id: string
      title: string
      description: string | null
      department: string | null
      week_number: number | null
      year: number | null
      category: string
      severity: string
      likelihood: number
      impact: number
      risk_score: number
      mitigation_plan: string | null
      contingency_plan: string | null
      owner_id: string | null
      status: string
      report_id: string | null
      position: number
      created_by: string | null
      created_at: string
      updated_at: string
      profiles: ProfileShape | null
    }> = []

    for (const report of (wrData || []) as unknown as FallbackReportRow[]) {
      const profile = Array.isArray(report.profiles) ? report.profiles[0] || null : report.profiles
      const challengesText = report.challenges || ""
      const lines = challengesText
        .split(/\r?\n/)
        .map((l: string) => l.replace(/^(?:\s*(?:\d+[.)]\s*|[-*•]\s*))+/, "").trim())
        .filter((l: string) => l.length > 2)

      lines.forEach((line: string, idx: number) => {
        if (searchParam && searchParam.trim() && !line.toLowerCase().includes(searchParam.toLowerCase().trim())) {
          return
        }

        fallbackRisks.push({
          id: `wr-${report.id}-${idx}`,
          title: line,
          description: null,
          department: report.department,
          week_number: report.week_number,
          year: report.year,
          category: "operational",
          severity: "medium",
          likelihood: 2,
          impact: 2,
          risk_score: 4,
          mitigation_plan: null,
          contingency_plan: null,
          owner_id: report.user_id,
          status: "open",
          report_id: report.id,
          position: idx,
          created_by: report.user_id,
          created_at: report.created_at,
          updated_at: report.created_at,
          profiles: profile,
        })
      })
    }

    let filtered = fallbackRisks
    if (severityParam && severityParam !== "all") {
      filtered = filtered.filter((r) => r.severity === severityParam)
    }
    if (statusParam && statusParam !== "all") {
      filtered = filtered.filter((r) => r.status === statusParam)
    }
    if (categoryParam && categoryParam !== "all") {
      filtered = filtered.filter((r) => r.category === categoryParam)
    }

    return NextResponse.json({ data: filtered })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    log.error({ err: msg }, "Failed to fetch risk register")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const json = await request.json()
    const parsed = CreateRiskSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("risk_register")
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      log.error({ err: error.message }, "Failed to create risk register item")
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    log.error({ err: msg }, "Failed to create risk register item")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
