import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { enforceRouteAccessV2, requireAccessContextV2 } from "@/lib/admin/api-guard-v2"
import { canMutateV2, type AccessContextV2 } from "@/lib/admin/policy-v2"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { serverError } from "@/lib/api/errors"

const log = logger("hr-performance-cbt-question-detail")

const UpdateSchema = z.object({
  department: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1).optional(),
  option_a: z.string().trim().min(1).optional(),
  option_b: z.string().trim().min(1).optional(),
  option_c: z.string().trim().min(1).optional(),
  option_d: z.string().trim().min(1).optional(),
  correct_option: z.enum(["A", "B", "C", "D"]).optional(),
  explanation: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional(),
})

async function getAuthorizedContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null as null }
  return { supabase, dataClient: getServiceRoleClientOrFallback(supabase), user }
}

/**
 * Confirms the caller may manage the department that owns this question.
 * Global admins have full access across all departments; department leads
 * are restricted to questions within their owned department(s).
 */
async function assertCanManageQuestion(
  dataClient: { from: (table: string) => any },
  context: AccessContextV2,
  questionId: string,
  _options: { allowContentBlindDelete?: boolean } = {}
): Promise<NextResponse | null> {
  const { data: existing } = await dataClient
    .from("cbt_questions")
    .select("department")
    .eq("id", questionId)
    .maybeSingle()

  const row = existing as { department?: string | null } | null
  const department = row?.department ?? null
  if (!department) return NextResponse.json({ error: "Question not found" }, { status: 404 })

  if (context.actingContext === "global_admin") {
    return null
  }

  if (!canMutateV2(context, "hr.pms.cbt.manage", department)) {
    return NextResponse.json({ error: "You can only manage CBT questions for your own department" }, { status: 403 })
  }
  return null
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`hr-performance-cbt-questions:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const { supabase, dataClient, user } = await getAuthorizedContext()
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

    const parsed = UpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const patchDenied = await assertCanManageQuestion(dataClient, contextResult.context, params.id)
    if (patchDenied) return patchDenied

    // Reassigning a question to a department the caller does not manage would
    // move it out of their scope.
    if (parsed.data.department && !canMutateV2(contextResult.context, "hr.pms.cbt.manage", parsed.data.department)) {
      return NextResponse.json({ error: "You can only manage CBT questions for your own department" }, { status: 403 })
    }

    const { data, error } = await dataClient
      .from("cbt_questions")
      .update(parsed.data)
      .eq("id", params.id)
      .select(
        "id, review_cycle_id, department, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, created_at"
      )
      .single()

    if (error || !data) {
      return serverError(log, error, "Failed to update question")
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "cbt_question",
        entityId: params.id,
        newValues: parsed.data,
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/cbt/questions/[id]" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data })
  } catch (error) {
    log.error({ err: String(error) }, "Failed to update CBT question")
    return NextResponse.json({ error: "Failed to update CBT question" }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit("hr-performance-cbt-questions", { limit: 20, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const { supabase, dataClient, user } = await getAuthorizedContext()
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

    const deleteDenied = await assertCanManageQuestion(dataClient, contextResult.context, params.id, {
      allowContentBlindDelete: true,
    })
    if (deleteDenied) return deleteDenied

    const { error } = await dataClient.from("cbt_questions").delete().eq("id", params.id)
    if (error) {
      return serverError(log, error)
    }

    await writeAuditLog(
      supabase,
      {
        action: "delete",
        entityType: "cbt_question",
        entityId: params.id,
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/cbt/questions/[id]" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, "Failed to delete CBT question")
    return NextResponse.json({ error: "Failed to delete CBT question" }, { status: 500 })
  }
}
