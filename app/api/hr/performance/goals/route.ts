import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("performance-goals")
const CreateGoalSchema = z.object({
  user_id: z.string().trim().min(1, "Missing required fields"),
  review_cycle_id: z.string().optional().nullable(),
  title: z.string().trim().min(1, "Missing required fields"),
  description: z.string().optional().nullable(),
  target_value: z.coerce.number().optional(),
  priority: z.string().optional(),
  due_date: z.string().optional().nullable(),
})

const UpdateGoalApprovalSchema = z.object({
  id: z.string().trim().min(1, "Goal ID and valid approval_status required"),
  approval_status: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "Goal ID and valid approval_status required" }),
  }),
})

const UpdateGoalSchema = z.object({
  id: z.string().trim().min(1, "Goal ID is required"),
  title: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  target_value: z.number().optional().nullable(),
  achieved_value: z.number().optional().nullable(),
  status: z.string().optional(),
  priority: z.string().optional(),
  due_date: z.string().optional().nullable(),
  approval_status: z.enum(["pending"]).optional(),
})

type GoalOwnerRecord = {
  id: string
  user_id: string
  department?: string | null
}

type GoalProfileRecord = {
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

type GoalCycleRecord = {
  id: string
  name?: string | null
  review_type?: string | null
}

type GoalRow = {
  id: string
  user_id: string
  review_cycle_id?: string | null
  title: string
  description?: string | null
  target_value?: number | null
  achieved_value?: number | null
  status?: string | null
  priority?: string | null
  due_date?: string | null
  created_at?: string | null
  updated_at?: string | null
}

async function attachGoalCycles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  goals: GoalRow[]
) {
  const cycleIds = Array.from(new Set(goals.map((goal) => goal.review_cycle_id).filter(Boolean)))
  if (cycleIds.length === 0) {
    return goals.map((goal) => ({ ...goal, cycle: null }))
  }

  const { data: cycles } = await supabase
    .from("review_cycles")
    .select("id, name, review_type")
    .in("id", cycleIds)
    .returns<GoalCycleRecord[]>()

  const cyclesById = new Map((cycles || []).map((cycle) => [cycle.id, cycle]))

  return goals.map((goal) => ({
    ...goal,
    cycle: goal.review_cycle_id ? cyclesById.get(goal.review_cycle_id) || null : null,
  }))
}

function isAdminProfile(profile: GoalProfileRecord | null | undefined) {
  return ["developer", "admin", "super_admin"].includes(String(profile?.role || "").toLowerCase())
}

function canManageGoalOwner(profile: GoalProfileRecord | null | undefined, goalDepartment: string | null | undefined) {
  if (isAdminProfile(profile)) return true
  if (!profile?.is_department_lead || !goalDepartment) return false
  const managedDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return profile.department === goalDepartment || managedDepartments.includes(goalDepartment)
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
    const userId = searchParams.get("user_id") || user.id
    const cycleId = searchParams.get("cycle_id")
    if (userId !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, department, is_department_lead, lead_departments")
        .eq("id", user.id)
        .single<GoalProfileRecord>()
      const { data: goalOwnerProfile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", userId)
        .single<{ department?: string | null }>()

      if (!isAdminProfile(profile) && !canManageGoalOwner(profile, goalOwnerProfile?.department)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    let query = supabase.from("goals_objectives").select("*").eq("user_id", userId).order("created_at", { ascending: false })

    if (cycleId) {
      query = query.eq("review_cycle_id", cycleId)
    }

    const { data: goals, error } = await query.returns<GoalRow[]>()

    if (error) {
      log.error({ err: error }, "Error fetching goals")
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 })
    }

    return NextResponse.json({ data: await attachGoalCycles(supabase, goals || []) })
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
    const parsed = CreateGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const { user_id, review_cycle_id, title, description, target_value, priority, due_date } = parsed.data

    if (user_id !== user.id) {
      const [{ data: actorProfile }, { data: targetProfile }] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, department, is_department_lead, lead_departments")
          .eq("id", user.id)
          .single<GoalProfileRecord>(),
        supabase.from("profiles").select("department").eq("id", user_id).single<{ department?: string | null }>(),
      ])

      if (!isAdminProfile(actorProfile) && !canManageGoalOwner(actorProfile, targetProfile?.department)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
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
      .select("*")
      .returns<GoalRow[]>()
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
      data: (await attachGoalCycles(supabase, [goal]))[0],
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
    const parsed = UpdateGoalApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const { id, approval_status } = parsed.data

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
    const parsed = UpdateGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const { id, ...updates } = parsed.data
    const [{ data: existingGoal }, { data: profile }] = await Promise.all([
      supabase.from("goals_objectives").select("id, user_id, department").eq("id", id).single<GoalOwnerRecord>(),
      supabase
        .from("profiles")
        .select("role, department, is_department_lead, lead_departments")
        .eq("id", user.id)
        .single<GoalProfileRecord>(),
    ])
    if (!existingGoal) return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    const isOwner = existingGoal.user_id === user.id
    const managerCanUpdate = canManageGoalOwner(profile, existingGoal.department)
    if (!isOwner && !managerCanUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!isOwner && updates.approval_status === "pending") {
      return NextResponse.json({ error: "Only the goal owner can request approval" }, { status: 403 })
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
