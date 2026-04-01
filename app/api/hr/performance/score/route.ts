import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger("hr-performance-score")

// GET /api/hr/performance/score?user_id=...&cycle_id=...
// Returns all 4 PMS score components for a user in a review cycle.
// KPI score is computed from linked tasks + goal progress.
// Attendance and CBT scores are pulled from their respective tables.
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
    const targetUserId = searchParams.get("user_id") || user.id
    const cycleId = searchParams.get("cycle_id")

    // Only managers/admins can request scores for other users
    if (targetUserId !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_department_lead")
        .eq("id", user.id)
        .single()

      if (!profile || (!["developer", "admin", "super_admin"].includes(profile.role) && !profile.is_department_lead)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // ── 1. KPI Achievement Score (70%) ────────────────────────────────────
    // For each approved goal in the cycle, compute effective progress.
    // If tasks are linked → use (completed tasks / total linked tasks) * 100
    // Otherwise → use (achieved_value / target_value) * 100
    let goalQuery = supabase
      .from("goals_objectives")
      .select("id, title, target_value, achieved_value, approval_status")
      .eq("user_id", targetUserId)
      .eq("approval_status", "approved")

    if (cycleId) {
      goalQuery = goalQuery.eq("review_cycle_id", cycleId)
    }

    const { data: goals } = await goalQuery

    let kpiScore = 0
    const goalBreakdown: Array<{
      goal_id: string
      title: string
      linked_tasks_total: number
      linked_tasks_completed: number
      goal_progress_pct: number
      effective_kpi_pct: number
    }> = []

    if (goals && goals.length > 0) {
      // Fetch linked tasks per goal
      const goalIds = goals.map((g) => g.id)
      const { data: linkedTasks } = await supabase.from("tasks").select("id, goal_id, status").in("goal_id", goalIds)

      const tasksByGoal = new Map<string, Array<{ status: string }>>()
      for (const task of linkedTasks ?? []) {
        if (!task.goal_id) continue
        if (!tasksByGoal.has(task.goal_id)) tasksByGoal.set(task.goal_id, [])
        tasksByGoal.get(task.goal_id)!.push({ status: task.status })
      }

      let totalPct = 0
      for (const goal of goals) {
        const tasks = tasksByGoal.get(goal.id) ?? []
        const totalTasks = tasks.length
        const completedTasks = tasks.filter((t) => t.status === "completed").length

        const goalProgressPct =
          goal.target_value && goal.target_value > 0
            ? Math.min(((goal.achieved_value ?? 0) / goal.target_value) * 100, 100)
            : 0

        const effectivePct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : goalProgressPct

        goalBreakdown.push({
          goal_id: goal.id,
          title: goal.title,
          linked_tasks_total: totalTasks,
          linked_tasks_completed: completedTasks,
          goal_progress_pct: Math.round(goalProgressPct * 100) / 100,
          effective_kpi_pct: Math.round(effectivePct * 100) / 100,
        })

        totalPct += effectivePct
      }

      kpiScore = Math.round((totalPct / goals.length) * 100) / 100
    }

    // ── 2. Attendance Score (10%) ─────────────────────────────────────────
    // Pull from attendance_records. Score = (present_days / working_days) * 100
    // Scoped to cycle date range if cycle_id provided.
    let attendanceScore = 0
    const attendanceBreakdown: { present: number; total: number; score: number } = {
      present: 0,
      total: 0,
      score: 0,
    }

    if (cycleId) {
      const { data: cycle } = await supabase
        .from("review_cycles")
        .select("start_date, end_date")
        .eq("id", cycleId)
        .single()

      if (cycle) {
        const { data: attendance } = await supabase
          .from("attendance_records")
          .select("status")
          .eq("user_id", targetUserId)
          .gte("date", cycle.start_date)
          .lte("date", cycle.end_date)

        if (attendance && attendance.length > 0) {
          const present = attendance.filter((r) =>
            ["present", "late", "wfh", "remote"].includes(r.status?.toLowerCase() ?? "")
          ).length
          attendanceBreakdown.present = present
          attendanceBreakdown.total = attendance.length
          attendanceScore = Math.round((present / attendance.length) * 100 * 100) / 100
          attendanceBreakdown.score = attendanceScore
        }
      }
    }

    // ── 3. CBT/Knowledge Score (10%) ──────────────────────────────────────
    // Pulled from kss_results if available, else 0 (not yet recorded)
    const cbtScore = 0
    // TODO: query kss_results table when CBT scoring is implemented

    // ── 4. Final weighted score ────────────────────────────────────────────
    const finalScore = Math.round((kpiScore * 0.7 + cbtScore * 0.1 + attendanceScore * 0.1 + 0 * 0.1) * 100) / 100

    return NextResponse.json({
      data: {
        user_id: targetUserId,
        cycle_id: cycleId,
        kpi_score: kpiScore,
        cbt_score: cbtScore,
        attendance_score: attendanceScore,
        behaviour_score: null, // filled in by manager on review form
        final_score: finalScore,
        breakdown: {
          goals: goalBreakdown,
          attendance: attendanceBreakdown,
        },
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in GET /api/hr/performance/score")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
