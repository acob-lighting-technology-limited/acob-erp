import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { computeIndividualPerformanceScore } from "@/lib/performance/scoring"
import { getUnifiedPerformanceReviews } from "@/lib/performance/review-data"

const log = logger("hr-performance-reviews")
const CreatePerformanceReviewSchema = z.object({
  user_id: z.string().trim().min(1, "Missing required fields"),
  review_cycle_id: z.string().trim().min(1, "Missing required fields"),
  overall_rating: z.unknown().optional(),
  strengths: z.unknown().optional(),
  areas_for_improvement: z.unknown().optional(),
  goals_achieved: z.unknown().optional(),
  goals_total: z.unknown().optional(),
  manager_comments: z.unknown().optional(),
  kpi_score: z.unknown().optional(),
  cbt_score: z.unknown().optional(),
  attendance_score: z.unknown().optional(),
  behaviour_score: z.unknown().optional(),
  behaviour_competencies: z.unknown().optional(),
})

const UpdatePerformanceReviewSchema = z.object({
  id: z.string().trim().min(1, "Review ID is required"),
  acknowledge: z.boolean().optional(),
  employee_comments: z.string().optional().nullable(),
})

type ExistingReviewRow = {
  id: string
  created_at: string
  status: string | null
  strengths: string | null
  areas_for_improvement: string | null
  manager_comments: string | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
  behaviour_competencies: Record<string, unknown> | null
}

type ReviewRow = {
  id: string
  user_id: string
  review_cycle_id: string
}

function reviewStatusPriority(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "completed") return 3
  if (normalized === "submitted") return 2
  if (normalized === "draft") return 1
  return 0
}

function pickCanonicalReview(reviews: ExistingReviewRow[]) {
  return [...reviews].sort((left, right) => {
    const statusDiff = reviewStatusPriority(right.status) - reviewStatusPriority(left.status)
    if (statusDiff !== 0) return statusDiff
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })[0]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get("cycle_id")
    const userId = searchParams.get("user_id")

    if (userId && userId !== user.id) {
      const [{ data: profile }, { data: targetProfile }] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, department, is_department_lead, lead_departments")
          .eq("id", user.id)
          .single<{
            role?: string | null
            department?: string | null
            is_department_lead?: boolean | null
            lead_departments?: string[] | null
          }>(),
        supabase.from("profiles").select("department").eq("id", userId).single<{ department?: string | null }>(),
      ])

      const role = String(profile?.role || "").toLowerCase()
      const isAdmin = ["developer", "admin", "super_admin"].includes(role)
      const managedDepartments = Array.isArray(profile?.lead_departments) ? profile.lead_departments : []
      const canLeadTarget =
        profile?.is_department_lead === true &&
        Boolean(
          targetProfile?.department &&
            (targetProfile.department === profile.department || managedDepartments.includes(targetProfile.department))
        )

      if (!isAdmin && !canLeadTarget) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const reviews = await getUnifiedPerformanceReviews(supabase, { userId, cycleId })
    return NextResponse.json({ data: reviews })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/hr/performance/reviews:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin or department lead
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_department_lead")
      .eq("id", user.id)
      .single()

    if (!profile || (!["developer", "admin", "super_admin"].includes(profile.role) && !profile.is_department_lead)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = CreatePerformanceReviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const {
      user_id,
      review_cycle_id,
      overall_rating,
      strengths,
      areas_for_improvement,
      goals_achieved,
      goals_total,
      manager_comments,
      // PMS 4-component scores
      kpi_score: _kpiScore,
      cbt_score: _cbtScore,
      attendance_score: _attendanceScore,
      behaviour_score: _behaviourScore,
      behaviour_competencies,
    } = parsed.data

    const { data: existingReviews } = await supabase
      .from("performance_reviews")
      .select(
        "id, created_at, status, strengths, areas_for_improvement, manager_comments, kpi_score, cbt_score, attendance_score, behaviour_score, behaviour_competencies"
      )
      .eq("user_id", user_id)
      .eq("review_cycle_id", review_cycle_id)
      .returns<ExistingReviewRow[]>()

    const canonicalReview = existingReviews && existingReviews.length > 0 ? pickCanonicalReview(existingReviews) : null

    const computedScore = await computeIndividualPerformanceScore(supabase, {
      userId: user_id,
      cycleId: review_cycle_id,
    })

    const parsedCompetencies =
      typeof behaviour_competencies === "object" && behaviour_competencies !== null
        ? (behaviour_competencies as Record<string, unknown>)
        : null

    const competencyKeys = [
      "collaboration",
      "accountability",
      "communication",
      "teamwork",
      "loyalty",
      "professional_conduct",
    ] as const
    const competencyValues = parsedCompetencies
      ? competencyKeys.map((key) => {
          const raw = parsedCompetencies[key]
          const normalized = typeof raw === "number" ? raw : Number(raw)
          return Number.isFinite(normalized) ? Math.max(0, Math.min(100, normalized)) : 0
        })
      : []
    const competencyAverage =
      competencyValues.length > 0
        ? Math.round((competencyValues.reduce((sum, value) => sum + value, 0) / competencyValues.length) * 100) / 100
        : null

    const payload = {
      user_id,
      reviewer_id: user.id,
      review_cycle_id,
      overall_rating: overall_rating ?? computedScore.final_score,
      strengths,
      areas_for_improvement,
      goals_achieved,
      goals_total,
      manager_comments,
      kpi_score: computedScore.kpi_score,
      cbt_score: computedScore.cbt_score,
      attendance_score: computedScore.attendance_score,
      behaviour_score: competencyAverage ?? computedScore.behaviour_score,
      behaviour_competencies: parsedCompetencies,
      status: "draft",
    }

    const reviewQuery = canonicalReview
      ? supabase.from("performance_reviews").update(payload).eq("id", canonicalReview.id)
      : supabase.from("performance_reviews").insert(payload)

    const { data: review, error } = await reviewQuery.select("id, user_id, review_cycle_id").single<ReviewRow>()

    if (error) {
      log.error({ err: String(error) }, "Error creating performance review:")
      return NextResponse.json({ error: "Failed to create performance review" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: canonicalReview ? "update" : "create",
        entityType: "performance_review",
        entityId: review.id,
        newValues: {
          user_id,
          review_cycle_id,
          overall_rating,
          kpi_score: computedScore.kpi_score,
          cbt_score: computedScore.cbt_score,
          attendance_score: computedScore.attendance_score,
          behaviour_score: competencyAverage ?? computedScore.behaviour_score,
          status: "draft",
        },
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/reviews" },
      },
      { failOpen: true }
    )

    const hydratedReview = review
      ? (
          await getUnifiedPerformanceReviews(supabase, {
            userId: review.user_id,
            cycleId: review.review_cycle_id,
          })
        )[0] || review
      : review

    return NextResponse.json({
      data: hydratedReview,
      message: canonicalReview ? "Performance review updated successfully" : "Performance review created successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/hr/performance/reviews:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = UpdatePerformanceReviewSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    if (!parsed.data.acknowledge) {
      return NextResponse.json({ error: "Unsupported review update request" }, { status: 400 })
    }

    const { data: review, error: reviewError } = await supabase
      .from("performance_reviews")
      .select("id, user_id, acknowledged_at, employee_comments")
      .eq("id", parsed.data.id)
      .single()

    if (reviewError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    if (review.user_id !== user.id) {
      return NextResponse.json({ error: "Only the reviewed employee can acknowledge this review" }, { status: 403 })
    }

    if (review.acknowledged_at) {
      return NextResponse.json({ error: "Review has already been acknowledged" }, { status: 400 })
    }

    const acknowledgedAt = new Date().toISOString()
    const { data: updatedReview, error: updateError } = await supabase
      .from("performance_reviews")
      .update({
        acknowledged_at: acknowledgedAt,
        acknowledged_by: user.id,
        employee_comments: parsed.data.employee_comments ?? null,
      })
      .eq("id", parsed.data.id)
      .select("*")
      .single()

    if (updateError || !updatedReview) {
      return NextResponse.json({ error: updateError?.message || "Failed to acknowledge review" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "performance_review.acknowledge",
        entityType: "performance_review",
        entityId: review.id,
        oldValues: { acknowledged_at: null, employee_comments: review.employee_comments ?? null },
        newValues: { acknowledged_at: acknowledgedAt, employee_comments: parsed.data.employee_comments ?? null },
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/reviews" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updatedReview, message: "Review acknowledged successfully" })
  } catch (error) {
    log.error({ err: String(error) }, "Error in PATCH /api/hr/performance/reviews:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
