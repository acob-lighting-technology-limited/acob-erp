import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

const log = logger("hr-performance-cbt-questions")

const QuestionSchema = z.object({
  review_cycle_id: z.string().uuid("Review cycle is required"),
  prompt: z.string().trim().min(1, "Question is required"),
  option_a: z.string().trim().min(1, "Option A is required"),
  option_b: z.string().trim().min(1, "Option B is required"),
  option_c: z.string().trim().min(1, "Option C is required"),
  option_d: z.string().trim().min(1, "Option D is required"),
  correct_option: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional().default(true),
})

type AccessProfile = {
  role?: string | null
}

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
}

function canManageQuestions(role: string | null | undefined) {
  return ["developer", "super_admin"].includes(String(role || "").toLowerCase())
}

function canViewQuestions(role: string | null | undefined) {
  return ["developer", "super_admin", "admin"].includes(String(role || "").toLowerCase())
}

async function getAuthorizedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<AccessProfile>()
  return { supabase, dataClient: getServiceRoleClientOrFallback(supabase), user, profile }
}

export async function GET(request: NextRequest) {
  try {
    const { dataClient, user, profile } = await getAuthorizedProfile()
    if (!user || !canViewQuestions(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cycleId = new URL(request.url).searchParams.get("cycle_id")
    let query = dataClient
      .from("cbt_questions")
      .select(
        "id, review_cycle_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, created_at"
      )
      .order("created_at", { ascending: false })

    if (cycleId) {
      query = query.eq("review_cycle_id", cycleId)
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
  try {
    const { supabase, dataClient, user, profile } = await getAuthorizedProfile()
    if (!user || !canManageQuestions(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = QuestionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const { data, error } = await dataClient
      .from("cbt_questions")
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select(
        "id, review_cycle_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, created_at"
      )
      .single<CbtQuestionRow>()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to create question" }, { status: 500 })
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
