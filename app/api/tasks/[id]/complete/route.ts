import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"

const log = logger("tasks-complete-route")

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: assignment } = await supabase
      .from("task_assignments")
      .select("task_id, user_id")
      .eq("task_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: "Only assigned users can complete this task" }, { status: 403 })
    }

    const { data: existingCompletion } = await supabase
      .from("task_user_completion")
      .select("task_id")
      .eq("task_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingCompletion) {
      return NextResponse.json({ error: "Task completion already recorded" }, { status: 409 })
    }

    const { error: insertError } = await supabase.from("task_user_completion").insert({
      task_id: params.id,
      user_id: user.id,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const [{ count: assignmentCount }, { count: completionCount }] = await Promise.all([
      supabase.from("task_assignments").select("*", { head: true, count: "exact" }).eq("task_id", params.id),
      supabase.from("task_user_completion").select("*", { head: true, count: "exact" }).eq("task_id", params.id),
    ])

    const allDone = Boolean(assignmentCount && completionCount && assignmentCount === completionCount)
    if (allDone) {
      await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", params.id)
    }

    await writeAuditLog(
      supabase,
      {
        action: "task.user_complete",
        entityType: "task",
        entityId: params.id,
        newValues: { user_id: user.id, all_done: allDone },
        context: { actorId: user.id, source: "api", route: "/api/tasks/[id]/complete" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ completed: true, allDone })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task complete POST")
    return NextResponse.json({ error: "Failed to record completion" }, { status: 500 })
  }
}
