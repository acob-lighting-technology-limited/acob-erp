import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { enforceRouteAccessV2, requireAccessContextV2 } from "@/lib/admin/api-guard-v2"
import { canMutateV2 } from "@/lib/admin/policy-v2"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { serverError } from "@/lib/api/errors"

const log = logger("api-cbt-questions-import")

const QuestionItemSchema = z.object({
  department: z.string().trim().min(1, "Department is required"),
  prompt: z.string().trim().min(1, "Question prompt is required"),
  option_a: z.string().trim().min(1, "Option A is required"),
  option_b: z.string().trim().min(1, "Option B is required"),
  option_c: z.string().trim().min(1, "Option C is required"),
  option_d: z.string().trim().min(1, "Option D is required"),
  correct_option: z.enum(["A", "B", "C", "D"], {
    errorMap: () => ({ message: "Correct option must be A, B, C, or D" }),
  }),
  explanation: z.string().trim().optional().nullable(),
})

const BatchImportSchema = z.object({
  review_cycle_id: z.string().uuid("Review cycle ID is required"),
  questions: z
    .array(QuestionItemSchema)
    .min(1, "At least one question is required")
    .max(500, "Maximum 500 questions per import"),
})

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`hr-performance-cbt-questions-import:${getClientId(request)}`, {
    limit: 10,
    windowSec: 60,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    const body = await request.json().catch(() => null)
    const parsed = BatchImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const { review_cycle_id, questions } = parsed.data

    // Department leads may only import questions for departments they manage
    if (contextResult.context.actingContext !== "global_admin") {
      for (const q of questions) {
        if (!canMutateV2(contextResult.context, "hr.pms.cbt.manage", q.department)) {
          return NextResponse.json(
            { error: `You do not have permission to import questions for department '${q.department}'.` },
            { status: 403 }
          )
        }
      }
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    const insertRows = questions.map((q) => ({
      review_cycle_id,
      department: q.department,
      prompt: q.prompt,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: q.explanation || null,
      is_active: true,
      created_by: user.id,
    }))

    const { data: inserted, error: insertError } = await dataClient
      .from("cbt_questions")
      .insert(insertRows)
      .select("id")

    if (insertError) {
      return serverError(log, insertError, "Failed to import CBT questions")
    }

    const count = inserted?.length ?? insertRows.length

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "cbt_questions_batch",
        entityId: review_cycle_id,
        newValues: { count, review_cycle_id },
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/cbt/questions/import" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true, count }, { status: 201 })
  } catch (error) {
    log.error(
      { err: JSON.stringify(error, Object.getOwnPropertyNames(error || {})) },
      "Failed to batch import CBT questions"
    )
    return NextResponse.json({ error: "Failed to batch import CBT questions" }, { status: 500 })
  }
}
