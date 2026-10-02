import { NextRequest, NextResponse } from "next/server"
import { ProjectInputSchema, parseCapacity } from "@/lib/projects/schemas"
import { parseJsonBody } from "@/lib/api/parse-body"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { serverError } from "@/lib/api/errors"

export const dynamic = "force-dynamic"
const log = logger("projects-api")

// GET /api/projects - List scoped projects with task counts for progress bars
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`projects:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dataClient = getServiceRoleClientOrFallback<any>(supabase as any)

  try {
    const { data: projects, error } = await dataClient
      .from("projects")
      .select(
        `
        *,
        project_manager:profiles!project_manager_id(
          id,
          full_name,
          first_name,
          last_name
        ),
        portfolio:portfolios!portfolio_id(
          id,
          name,
          code
        ),
        tasks:tasks(
          id,
          status,
          weight,
          rating,
          is_archived,
          due_date,
          task_end_date,
          plan_id,
          completed_at
        ),
        plans:implementation_plans(id)
      `
      )
      .order("project_name", { ascending: true })

    if (error) {
      log.error({ err: error.message }, "Failed to fetch projects")
      return NextResponse.json({ error: "Failed to load projects" }, { status: 500 })
    }

    return NextResponse.json({ data: projects || [] })
  } catch (err) {
    log.error({ err }, "Unexpected error in projects GET")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`projects-write:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const parsed = await parseJsonBody(request, ProjectInputSchema)
    if (!parsed.ok) return parsed.response
    const {
      project_name,
      location,
      deployment_start_date,
      deployment_end_date,
      capacity_w,
      technology_type,
      project_manager_id,
      description,
      status,
      portfolio_id,
      priority,
    } = parsed.data

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        project_name,
        location,
        deployment_start_date,
        deployment_end_date,
        capacity_w: parseCapacity(capacity_w),
        technology_type,
        project_manager_id: project_manager_id || null,
        portfolio_id: portfolio_id || null,
        description,
        status: status || "planning",
        ...(priority !== undefined ? { priority } : {}),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      log.error({ err: error.message }, "Failed to create project")
      return serverError(log, error, "The request could not be completed")
    }

    return NextResponse.json({ data: project })
  } catch (err: any) {
    log.error({ err }, "Unexpected error in projects POST")
    return serverError(log, err, "Internal server error")
  }
}
