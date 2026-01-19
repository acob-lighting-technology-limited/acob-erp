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
    const userId = searchParams.get("user_id") || user.id
    const cycleId = searchParams.get("cycle_id")

    let query = supabase
      .from("goals_objectives")
      .select(
        `
        *,
        user:profiles!goals_objectives_user_id_fkey (
          id,
          first_name,
          last_name,
          full_name
        ),
        cycle:review_cycles!goals_objectives_review_cycle_id_fkey (
          id,
          name,
          review_type
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (cycleId) {
      query = query.eq("review_cycle_id", cycleId)
    }

    const { data: goals, error } = await query

    if (error) {
      console.error("Error fetching goals:", error)
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 })
    }

    return NextResponse.json({ data: goals })
  } catch (error) {
    console.error("Error in GET /api/hr/performance/goals:", error)
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

    const body = await request.json()
    const { user_id, review_cycle_id, title, description, target_value, priority, due_date } = body

    if (!user_id || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create goal
    const { data: goal, error } = await supabase
      .from("goals_objectives")
      .insert({
        user_id,
        review_cycle_id,
        title,
        description,
        target_value,
        priority: priority || "medium",
        due_date,
        status: "in_progress",
      })
      .select(
        `
        *,
        user:profiles!goals_objectives_user_id_fkey (
          id,
          first_name,
          last_name,
          full_name
        )
      `
      )
      .single()

    if (error) {
      console.error("Error creating goal:", error)
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 })
    }

    return NextResponse.json({
      data: goal,
      message: "Goal created successfully",
    })
  } catch (error) {
    console.error("Error in POST /api/hr/performance/goals:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Goal ID is required" }, { status: 400 })
    }

    // Update goal
    const { data: goal, error } = await supabase.from("goals_objectives").update(updates).eq("id", id).select().single()

    if (error) {
      console.error("Error updating goal:", error)
      return NextResponse.json({ error: "Failed to update goal" }, { status: 500 })
    }

    return NextResponse.json({
      data: goal,
      message: "Goal updated successfully",
    })
  } catch (error) {
    console.error("Error in PUT /api/hr/performance/goals:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
