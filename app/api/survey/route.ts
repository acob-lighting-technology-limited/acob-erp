import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const log = logger("survey-route")

const SurveySubmissionSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  speedRating: z.number().int().min(1).max(5),
  usabilityRating: z.number().int().min(1).max(5),
  modulesUsed: z.array(z.string()).default([]),
  moduleRatings: z.record(z.string(), z.number().int().min(1).max(5)).default({}),
  trainingRating: z.enum(["adequate", "somewhat", "inadequate"]).nullable().optional(),
  biggestFrustration: z.string().trim().max(2000).nullable().optional(),
  desiredFeatures: z.string().trim().max(2000).nullable().optional(),
  isAnonymous: z.boolean().default(false),
})

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const { data: existingSurvey } = await dataClient
      .from("system_satisfaction_surveys")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    return NextResponse.json({ data: existingSurvey || null })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled survey GET error")
    return NextResponse.json({ data: null })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(`survey-post:${getClientId(request)}`, { limit: 10, windowSec: 60 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const json = await request.json().catch(() => null)
    const parsed = SurveySubmissionSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid survey data" }, { status: 400 })
    }

    const payload = parsed.data

    // Fetch user profile for department/designation context
    const { data: profile } = await dataClient
      .from("profiles")
      .select("department, designation, role")
      .eq("id", user.id)
      .maybeSingle()

    // Check if user already submitted a survey
    const { data: existing } = await dataClient
      .from("system_satisfaction_surveys")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    const surveyData = {
      user_id: user.id,
      department: profile?.department || null,
      role: profile?.designation || profile?.role || null,
      overall_rating: payload.overallRating,
      speed_rating: payload.speedRating,
      usability_rating: payload.usabilityRating,
      modules_used: payload.modulesUsed,
      module_ratings: payload.moduleRatings,
      training_rating: payload.trainingRating || null,
      biggest_frustration: payload.biggestFrustration || null,
      desired_features: payload.desiredFeatures || null,
      is_anonymous: payload.isAnonymous,
    }

    if (existing) {
      // Update existing record
      const { data: updated, error: updateError } = await dataClient
        .from("system_satisfaction_surveys")
        .update(surveyData)
        .eq("id", existing.id)
        .select("*")
        .single()

      if (updateError || !updated) {
        log.error({ err: String(updateError) }, "Failed to update survey")
        return NextResponse.json({ error: updateError?.message || "Failed to update survey" }, { status: 500 })
      }

      await writeAuditLog(
        dataClient,
        {
          action: "update",
          entityType: "system_satisfaction_survey",
          entityId: updated.id,
          newValues: { overall_rating: payload.overallRating, is_anonymous: payload.isAnonymous },
          context: { actorId: user.id, source: "api", route: "/api/survey" },
        },
        { failOpen: true }
      )

      return NextResponse.json({ data: updated })
    }

    const { data: created, error: insertError } = await dataClient
      .from("system_satisfaction_surveys")
      .insert(surveyData)
      .select("*")
      .single()

    if (insertError || !created) {
      log.error({ err: String(insertError) }, "Failed to insert survey")
      return NextResponse.json({ error: insertError?.message || "Failed to submit survey" }, { status: 500 })
    }

    await writeAuditLog(
      dataClient,
      {
        action: "create",
        entityType: "system_satisfaction_survey",
        entityId: created.id,
        newValues: { overall_rating: payload.overallRating, is_anonymous: payload.isAnonymous },
        context: { actorId: user.id, source: "api", route: "/api/survey" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled survey POST error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rl = await rateLimit(`survey-put:${getClientId(request)}`, { limit: 10, windowSec: 60 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const json = await request.json().catch(() => null)
    const parsed = SurveySubmissionSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid survey data" }, { status: 400 })
    }

    const payload = parsed.data

    const { data: updated, error: updateError } = await dataClient
      .from("system_satisfaction_surveys")
      .update({
        overall_rating: payload.overallRating,
        speed_rating: payload.speedRating,
        usability_rating: payload.usabilityRating,
        modules_used: payload.modulesUsed,
        module_ratings: payload.moduleRatings,
        training_rating: payload.trainingRating || null,
        biggest_frustration: payload.biggestFrustration || null,
        desired_features: payload.desiredFeatures || null,
        is_anonymous: payload.isAnonymous,
      })
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (updateError || !updated) {
      log.error({ err: String(updateError) }, "Failed to update survey")
      return NextResponse.json({ error: updateError?.message || "Failed to update survey" }, { status: 500 })
    }

    await writeAuditLog(
      dataClient,
      {
        action: "update",
        entityType: "system_satisfaction_survey",
        entityId: updated.id,
        newValues: { overall_rating: payload.overallRating, is_anonymous: payload.isAnonymous },
        context: { actorId: user.id, source: "api", route: "/api/survey" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updated })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled survey PUT error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
