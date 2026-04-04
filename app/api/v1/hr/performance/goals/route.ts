import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("v1-hr-performance-goals")
const CreateV1GoalSchema = z.object({
  user_id: z.string().trim().min(1, "Missing required fields"),
  review_cycle_id: z.string().optional().nullable(),
  title: z.string().trim().min(1, "Missing required fields"),
  description: z.string().optional().nullable(),
  target_value: z.unknown().optional(),
  priority: z.string().optional(),
  due_date: z.string().optional().nullable(),
})

const UpdateV1GoalSchema = z
  .object({
    id: z.string().trim().min(1, "Goal ID is required"),
  })
  .and(z.record(z.unknown()))

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
      log.error({ err: String(error) }, "Error fetching goals:")
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 })
    }

    return NextResponse.json({ data: goals })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/hr/performance/goals:")
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

    const body = await request.json()
    const parsed = CreateV1GoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const { user_id, review_cycle_id, title, description, target_value, priority, due_date } = parsed.data

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
      log.error({ err: String(error) }, "Error creating goal:")
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "goal",
        entityId: goal.id,
        newValues: { user_id, review_cycle_id, title, priority: priority || "medium" },
        context: { actorId: user.id, source: "api", route: "/api/v1/hr/performance/goals" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      data: goal,
      message: "Goal created successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/hr/performance/goals:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export async function POST(request: NextRequest) {
  return PATCH(request)
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
    const parsed = UpdateV1GoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const { id, ...updates } = parsed.data

    // Update goal
    const { data: goal, error } = await supabase.from("goals_objectives").update(updates).eq("id", id).select().single()

    if (error) {
      log.error({ err: String(error) }, "Error updating goal:")
      return NextResponse.json({ error: "Failed to update goal" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "goal",
        entityId: id,
        newValues: updates,
        context: { actorId: user.id, source: "api", route: "/api/v1/hr/performance/goals" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      data: goal,
      message: "Goal updated successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in PUT /api/hr/performance/goals:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
