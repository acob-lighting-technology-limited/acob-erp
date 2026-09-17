import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { computePortfolioHealth, computeProjectHealth, type ProjectHealthTask } from "@/lib/projects/health"
import { toLocalISODate } from "@/lib/utils/date"

export const dynamic = "force-dynamic"
const log = logger("portfolios-api")

const PortfolioSchema = z.object({
  name: z.string().trim().min(1, "Portfolio name is required"),
  code: z.string().trim().max(32).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(["active", "on_hold", "closed"]).default("active"),
})

type ProjectRow = {
  id: string
  project_name: string
  portfolio_id: string | null
  deployment_start_date: string | null
  deployment_end_date: string | null
  status: string | null
  tasks: (ProjectHealthTask & { plan_id?: string | null })[] | null
}

type PlanRow = {
  id: string
  project_id: string
  name: string
  sort_order: number
}

/**
 * GET /api/portfolios
 *
 * Returns each portfolio with its projects' health and implementation plan
 * progress rolled up. Progress is derived from the implementation plans and
 * tasks on every read — nothing is stored, preventing data drift.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`portfolios:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  try {
    const [
      { data: portfolios, error: portfolioError },
      { data: projects, error: projectError },
      { data: plans, error: plansError },
    ] = await Promise.all([
      supabase.from("portfolios").select("*").order("name", { ascending: true }),
      supabase
        .from("projects")
        .select(
          `id, project_name, portfolio_id, deployment_start_date, deployment_end_date, status,
           tasks:tasks(id, status, weight, rating, is_archived, due_date, task_end_date, plan_id)`
        )
        .order("project_name", { ascending: true }),
      supabase.from("implementation_plans").select("id, project_id, name, sort_order"),
    ])

    if (portfolioError) throw portfolioError
    if (projectError) throw projectError
    if (plansError) throw plansError

    const today = toLocalISODate()
    const projectsByPortfolio = new Map<string, ProjectRow[]>()
    for (const project of (projects || []) as ProjectRow[]) {
      const key = project.portfolio_id || ""
      const bucket = projectsByPortfolio.get(key) || []
      bucket.push(project)
      projectsByPortfolio.set(key, bucket)
    }

    const plansByProject = new Map<string, PlanRow[]>()
    for (const plan of (plans || []) as PlanRow[]) {
      const list = plansByProject.get(plan.project_id) || []
      list.push(plan)
      plansByProject.set(plan.project_id, list)
    }

    const withHealth = (portfolioId: string) => {
      const rows = projectsByPortfolio.get(portfolioId) || []
      let portfolioTotalPlans = 0
      let portfolioCompletedPlans = 0
      const planProgressRates: number[] = []

      const health = rows.map((project) => {
        const projectPlans = plansByProject.get(project.id) || []
        const activeTasks = (project.tasks || []).filter((t) => !t.is_archived)

        let projectCompletedPlans = 0
        const projectPlanProgressRates: number[] = []

        for (const plan of projectPlans) {
          const planTasks = activeTasks.filter((t) => t.plan_id === plan.id)
          const completedTasks = planTasks.filter((t) => t.status === "completed").length
          const isPlanCompleted = planTasks.length > 0 && completedTasks === planTasks.length
          if (isPlanCompleted) {
            projectCompletedPlans++
          }
          const pct = planTasks.length > 0 ? Math.round((completedTasks / planTasks.length) * 100) : 0
          projectPlanProgressRates.push(pct)
          planProgressRates.push(pct)
        }

        portfolioTotalPlans += projectPlans.length
        portfolioCompletedPlans += projectCompletedPlans

        const projectPlanProgressPct =
          projectPlans.length > 0
            ? Math.round(projectPlanProgressRates.reduce((sum, p) => sum + p, 0) / projectPlans.length)
            : activeTasks.length > 0
              ? Math.round((activeTasks.filter((t) => t.status === "completed").length / activeTasks.length) * 100)
              : null

        return {
          id: project.id,
          project_name: project.project_name,
          lifecycle_status: project.status,
          totalPlans: projectPlans.length,
          completedPlans: projectCompletedPlans,
          planProgressPct: projectPlanProgressPct,
          ...computeProjectHealth({
            startDate: project.deployment_start_date,
            endDate: project.deployment_end_date,
            tasks: project.tasks || [],
            today,
          }),
        }
      })

      const baseRollup = computePortfolioHealth(health)

      const totalActiveTasks = rows.flatMap((r) => r.tasks || []).filter((t) => !t.is_archived)
      const totalCompletedTasks = totalActiveTasks.filter((t) => t.status === "completed").length

      const overallPlanProgressPct =
        portfolioTotalPlans > 0
          ? Math.round(planProgressRates.reduce((sum, p) => sum + p, 0) / portfolioTotalPlans)
          : totalActiveTasks.length > 0
            ? Math.round((totalCompletedTasks / totalActiveTasks.length) * 100)
            : null

      return {
        projects: health,
        rollup: {
          ...baseRollup,
          totalPlans: portfolioTotalPlans,
          completedPlans: portfolioCompletedPlans,
          planProgressPct: overallPlanProgressPct,
        },
      }
    }

    const data = (portfolios || []).map((portfolio) => ({ ...portfolio, ...withHealth(portfolio.id) }))

    // Projects created before portfolios existed, or deliberately left out of
    // one, still need somewhere to be seen rather than silently vanishing.
    const unassigned = withHealth("")

    return NextResponse.json({ data, unassigned })
  } catch (error) {
    log.error({ err: String(error) }, "Failed to load portfolios")
    return apiError("Failed to load portfolios", ApiErrorCode.DATABASE_ERROR, 500)
  }
}

/** POST /api/portfolios — create a portfolio. Admin-only, enforced by RLS. */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`portfolios-write:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const parsed = PortfolioSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Validation failed", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const { data, error } = await supabase
    .from("portfolios")
    .insert({
      name: parsed.data.name,
      code: parsed.data.code || null,
      description: parsed.data.description || null,
      status: parsed.data.status,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    log.error({ err: error.message }, "Failed to create portfolio")
    return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 400)
  }

  return NextResponse.json({ data })
}
