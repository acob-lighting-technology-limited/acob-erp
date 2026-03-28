import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("performance-goals")

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
      log.error({ err: error }, "Error fetching goals")
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 })
    }

    return NextResponse.json({ data: goals })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in GET")
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
      log.error({ err: error }, "Error creating goal")
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "goal",
        entityId: goal.id,
        newValues: { user_id, review_cycle_id, title, priority: priority || "medium" },
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/goals" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      data: goal,
      message: "Goal created successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in POST")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

// PATCH: approve or reject a KPI (managers/admins only)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_department_lead")
      .eq("id", user.id)
      .single()

    if (!profile || (!["developer", "admin", "super_admin"].includes(profile.role) && !profile.is_department_lead)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { id, approval_status } = body

    if (!id || !["approved", "rejected"].includes(approval_status)) {
      return NextResponse.json({ error: "Goal ID and valid approval_status required" }, { status: 400 })
    }

    const { data: goal, error } = await supabase
      .from("goals_objectives")
      .update({
        approval_status,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      log.error({ err: error }, "Error approving goal")
      return NextResponse.json({ error: "Failed to update goal approval" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "goal",
        entityId: id,
        newValues: { approval_status, approved_by: user.id },
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/goals" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: goal, message: `KPI ${approval_status} successfully` })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in PATCH")
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
      log.error({ err: error }, "Error updating goal")
      return NextResponse.json({ error: "Failed to update goal" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "goal",
        entityId: id,
        newValues: updates,
        context: { actorId: user.id, source: "api", route: "/api/hr/performance/goals" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      data: goal,
      message: "Goal updated successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in PUT")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
