import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

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

    let query = supabase
      .from("performance_reviews")
      .select(
        `
        *,
        user:profiles!performance_reviews_user_id_fkey (
          id,
          first_name,
          last_name,
          full_name,
          company_email,
          department_id
        ),
        reviewer:profiles!performance_reviews_reviewer_id_fkey (
          id,
          first_name,
          last_name,
          full_name
        ),
        cycle:review_cycles!performance_reviews_review_cycle_id_fkey (
          id,
          name,
          review_type,
          start_date,
          end_date
        )
      `
      )
      .order("created_at", { ascending: false })

    if (cycleId) {
      query = query.eq("review_cycle_id", cycleId)
    }

    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data: reviews, error } = await query

    if (error) {
      log.error({ err: String(error) }, "Error fetching performance reviews:")
      return NextResponse.json({ error: "Failed to fetch performance reviews" }, { status: 500 })
    }

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
      kpi_score,
      cbt_score,
      attendance_score,
      behaviour_score,
      behaviour_competencies,
    } = parsed.data

    // Create performance review
    const { data: review, error } = await supabase
      .from("performance_reviews")
      .insert({
        user_id,
        reviewer_id: user.id,
        review_cycle_id,
        overall_rating,
        strengths,
        areas_for_improvement,
        goals_achieved,
        goals_total,
        manager_comments,
        kpi_score,
        cbt_score,
        attendance_score,
        behaviour_score,
        behaviour_competencies: behaviour_competencies ?? null,
        // final_score is auto-computed by DB trigger
        status: "draft",
      })
      .select(
        `
        *,
        user:profiles!performance_reviews_user_id_fkey (
          id,
          first_name,
          last_name,
          full_name
        ),
        cycle:review_cycles!performance_reviews_review_cycle_id_fkey (
          id,
          name,
          review_type
        )
      `
      )
      .single()

    if (error) {
      log.error({ err: String(error) }, "Error creating performance review:")
      return NextResponse.json({ error: "Failed to create performance review" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "performance_review",
        entityId: review.id,
        newValues: {
          user_id,
          review_cycle_id,
          overall_rating,
          kpi_score,
          cbt_score,
          attendance_score,
          behaviour_score,
          status: "draft",
        },
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/reviews" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      data: review,
      message: "Performance review created successfully",
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
