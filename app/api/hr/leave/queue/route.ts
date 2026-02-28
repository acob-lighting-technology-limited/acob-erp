import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { areRequiredDocumentsVerified, getLeavePolicy, LEAVE_PENDING_STAGES } from "@/lib/hr/leave-workflow"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    let query = supabase
      .from("leave_requests")
      .select(
        `
        *,
        user:profiles!leave_requests_user_id_fkey(id, full_name, company_email),
        reliever:profiles!leave_requests_reliever_id_fkey(id, full_name, company_email),
        supervisor:profiles!leave_requests_supervisor_id_fkey(id, full_name, company_email),
        leave_type:leave_types!leave_requests_leave_type_id_fkey(id, name)
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })

    if (["admin", "super_admin"].includes(profile?.role)) {
      query = query.eq("approval_stage", LEAVE_PENDING_STAGES.HR)
    } else {
      query = query.or(
        `and(approval_stage.eq.${LEAVE_PENDING_STAGES.RELIEVER},reliever_id.eq.${user.id}),and(approval_stage.eq.${LEAVE_PENDING_STAGES.SUPERVISOR},supervisor_id.eq.${user.id})`
      )
    }

    const { data: requests, error } = await query

    if (error) return NextResponse.json({ error: "Failed to fetch approval queue" }, { status: 500 })

    const { data: slaRows } = await supabase
      .from("approval_sla_policies")
      .select("stage, due_hours, reminder_hours_before")
      .eq("is_active", true)

    const slaMap = new Map((slaRows || []).map((row: any) => [row.stage, row]))

    const now = Date.now()
    const enriched = await Promise.all(
      (requests || []).map(async (item: any) => {
        const policy = slaMap.get(item.approval_stage) || { due_hours: 24, reminder_hours_before: 4 }
        const createdAt = new Date(item.created_at).getTime()
        const dueAt = createdAt + policy.due_hours * 60 * 60 * 1000
        const remainingMs = dueAt - now
        const dueStatus =
          remainingMs <= 0
            ? "overdue"
            : remainingMs <= policy.reminder_hours_before * 60 * 60 * 1000
              ? "due_soon"
              : "on_track"
        const leavePolicy = await getLeavePolicy(supabase, item.leave_type_id)
        const requiredDocs = leavePolicy.required_documents || []
        const evidenceStatus = await areRequiredDocumentsVerified(supabase, item.id, requiredDocs)

        return {
          ...item,
          required_documents: requiredDocs,
          evidence_complete: evidenceStatus.complete,
          missing_documents: evidenceStatus.missing,
          sla: {
            due_at: new Date(dueAt).toISOString(),
            due_status: dueStatus,
            hours_remaining: Math.floor(remainingMs / (1000 * 60 * 60)),
          },
        }
      })
    )

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/queue:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
