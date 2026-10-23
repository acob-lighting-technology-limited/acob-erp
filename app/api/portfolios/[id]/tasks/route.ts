import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { apiError, ApiErrorCode, serverError } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
const log = logger("portfolio-tasks-api")

/**
 * GET /api/portfolios/[id]/tasks — every task in the portfolio: those assigned
 * to the portfolio as a whole, plus those on each of its projects. A project
 * task stores only project_id; its portfolio is the project's, worked out here
 * on each read, so moving a project to another portfolio moves its tasks too.
 * Read with the caller's session, so RLS decides which ones they may see.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!z.string().uuid().safeParse(id).success) return apiError("Portfolio not found", ApiErrorCode.NOT_FOUND, 404)

  const rl = await rateLimit(`portfolio-tasks:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const { data: projects, error: projectsError } = await supabase.from("projects").select("id").eq("portfolio_id", id)
  if (projectsError) return serverError(log, projectsError, "Failed to load portfolio tasks")
  const projectIds = (projects || []).map((project) => project.id)
  const scope =
    projectIds.length > 0 ? `portfolio_id.eq.${id},project_id.in.(${projectIds.join(",")})` : `portfolio_id.eq.${id}`

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `id, title, description, priority, status, weight, rating, plan_id, due_date, task_start_date, task_end_date,
       work_item_number, assigned_to, department, goal_id, kpi_id, assignment_type, is_archived, project_id,
       assigned_user:profiles!assigned_to(first_name, last_name),
       project:projects(project_name)`
    )
    .or(scope)
    .eq("is_archived", false)
    .order("created_at", { ascending: true })
    .limit(1000)

  if (error) return serverError(log, error, "Failed to load portfolio tasks")
  return NextResponse.json({ data: data || [] })
}
