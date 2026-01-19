import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
      console.error("Error fetching performance reviews:", error)
      return NextResponse.json({ error: "Failed to fetch performance reviews" }, { status: 500 })
    }

    return NextResponse.json({ data: reviews })
  } catch (error) {
    console.error("Error in GET /api/hr/performance/reviews:", error)
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

    if (!profile || (!["admin", "super_admin"].includes(profile.role) && !profile.is_department_lead)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      user_id,
      review_cycle_id,
      overall_rating,
      strengths,
      areas_for_improvement,
      goals_achieved,
      goals_total,
      manager_comments,
    } = body

    if (!user_id || !review_cycle_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

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
      console.error("Error creating performance review:", error)
      return NextResponse.json({ error: "Failed to create performance review" }, { status: 500 })
    }

    return NextResponse.json({
      data: review,
      message: "Performance review created successfully",
    })
  } catch (error) {
    console.error("Error in POST /api/hr/performance/reviews:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
