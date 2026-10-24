import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { enforceRouteAccessV2, requireAccessContextV2 } from "@/lib/admin/api-guard-v2"
import { canMutateV2 } from "@/lib/admin/policy-v2"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { serverError } from "@/lib/api/errors"

const log = logger("hr-performance-cbt-questions")

const QuestionSchema = z.object({
  review_cycle_id: z.string().uuid("Review cycle is required"),
  department: z.string().trim().min(1, "Department is required"),
  prompt: z.string().trim().min(1, "Question is required"),
  option_a: z.string().trim().min(1, "Option A is required"),
  option_b: z.string().trim().min(1, "Option B is required"),
  option_c: z.string().trim().min(1, "Option C is required"),
  option_d: z.string().trim().min(1, "Option D is required"),
  correct_option: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional().default(true),
})

type CbtQuestionRow = {
  id: string
  prompt: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: "A" | "B" | "C" | "D"
  explanation?: string | null
  is_active: boolean
  created_at: string
  review_cycle_id?: string | null
  department?: string | null
}

async function getAuthorizedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null as null }
  return { supabase, dataClient: getServiceRoleClientOrFallback(supabase), user }
}

export async function GET(request: NextRequest) {
  try {
    const { dataClient, user } = await getAuthorizedProfile()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const contextResult = await requireAccessContextV2()
    if (!contextResult.ok) {
      return contextResult.response
    }
    const routeAccess = enforceRouteAccessV2(contextResult.context, "hr.pms.cbt.manage")
    if (!routeAccess.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // "all" for global admins; a department list for leads.
    const dataScope = routeAccess.dataScope

    const cycleId = request.nextUrl.searchParams.get("cycle_id")

    let query = dataClient
      .from("cbt_questions")
      .select(
        "id, review_cycle_id, department, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, created_at"
      )
      .order("created_at", { ascending: false })

    if (cycleId) {
      query = query.eq("review_cycle_id", cycleId)
    }

    // A lead sees only their own department's question bank; admins see all.
    if (dataScope !== "all") {
      if (dataScope === "none" || dataScope.length === 0) {
        return NextResponse.json({ data: [] })
      }
      query = query.in("department", dataScope)
    }

    const { data, error } = await query.returns<CbtQuestionRow[]>()

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    log.error({ err: String(error) }, "Failed to load CBT questions")
    return NextResponse.json({ error: "Failed to load CBT questions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`hr-performance-cbt-questions:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const { supabase, dataClient, user } = await getAuthorizedProfile()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const contextResult = await requireAccessContextV2()
    if (!contextResult.ok) {
      return contextResult.response
    }
    const routeAccess = enforceRouteAccessV2(contextResult.context, "hr.pms.cbt.manage")
    if (!routeAccess.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = QuestionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    if (!canMutateV2(contextResult.context, "hr.pms.cbt.manage", parsed.data.department)) {
      return NextResponse.json({ error: "You can only manage CBT questions for your own department" }, { status: 403 })
    }

    const { data, error } = await dataClient
      .from("cbt_questions")
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select(
        "id, review_cycle_id, department, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, created_at"
      )
      .single<CbtQuestionRow>()

    if (error || !data) {
      return serverError(log, error, "Failed to create question")
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "cbt_question",
        entityId: data.id,
        newValues: { prompt: data.prompt, correct_option: data.correct_option, is_active: data.is_active },
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/cbt/questions" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    log.error({ err: JSON.stringify(error, Object.getOwnPropertyNames(error || {})) }, "Failed to create CBT question")
    return NextResponse.json({ error: "Failed to create CBT question" }, { status: 500 })
  }
}
