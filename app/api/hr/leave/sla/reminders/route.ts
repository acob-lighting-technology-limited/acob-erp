import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { notifyUsers } from "@/lib/hr/leave-workflow"

const LEGACY_SLA_STAGE_MAP: Record<string, string> = {
  pending_reliever: "reliever_pending",
  pending_department_lead: "supervisor_pending",
  pending_admin_hr_lead: "hr_pending",
  pending_md: "hr_pending",
  pending_hcs: "hr_pending",
}

export async function POST() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!["developer", "admin", "super_admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: slaPolicies } = await supabase
      .from("approval_sla_policies")
      .select("stage, due_hours, reminder_hours_before, escalate_to_role")
      .eq("is_active", true)

    const policyMap = new Map((slaPolicies || []).map((item: any) => [item.stage, item]))

    const { data: pendingRequests, error } = await supabase
      .from("leave_requests")
      .select("id, current_stage_code, current_approver_user_id, created_at")
      .eq("status", "pending")

    if (error) return NextResponse.json({ error: "Failed to fetch pending leave requests" }, { status: 500 })

    const now = Date.now()
    let remindersSent = 0

    for (const request of pendingRequests || []) {
      if (!request.current_approver_user_id) continue

      const slaStage = LEGACY_SLA_STAGE_MAP[request.current_stage_code || ""] || "reliever_pending"
      const policy = policyMap.get(slaStage)
      if (!policy) continue

      const createdAt = new Date(request.created_at).getTime()
      const dueAt = createdAt + policy.due_hours * 60 * 60 * 1000
      const reminderAt = dueAt - policy.reminder_hours_before * 60 * 60 * 1000

      if (now >= reminderAt && now < dueAt) {
        await notifyUsers(supabase, {
          userIds: [request.current_approver_user_id],
          title: "Leave approval SLA reminder",
          message: `Leave request ${request.id} is due soon. Please review before SLA breach.`,
          linkUrl: "/dashboard/leave",
          entityId: request.id,
        })
        remindersSent += 1
      }

      if (now >= dueAt && policy.escalate_to_role) {
        const { data: escalatedUsers } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", policy.escalate_to_role)

        const escalateRecipients = (escalatedUsers || []).map((row: any) => row.id)
        if (escalateRecipients.length) {
          await notifyUsers(supabase, {
            userIds: escalateRecipients,
            title: "Leave approval SLA breached",
            message: `Leave request ${request.id} has breached SLA at ${request.current_stage_code}.`,
            linkUrl: "/admin/hr/leave/approve",
            entityId: request.id,
          })
          remindersSent += escalateRecipients.length
        }
      }
    }

    return NextResponse.json({ message: "SLA reminders processed", reminders_sent: remindersSent })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/sla/reminders:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
