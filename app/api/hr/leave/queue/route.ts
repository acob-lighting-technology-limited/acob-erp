import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { areRequiredDocumentsVerified, getLeavePolicy } from "@/lib/hr/leave-workflow"
import { logger } from "@/lib/logger"

const log = logger("hr-leave-queue")

const LEGACY_SLA_STAGE_MAP: Record<string, string> = {
  pending_reliever: "reliever_pending",
  pending_department_lead: "supervisor_pending",
  pending_admin_hr_lead: "hr_pending",
  pending_md: "hr_pending",
  pending_hcs: "hr_pending",
}

const ADMIN_LIKE_ROLES = ["developer", "admin", "super_admin"]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    const { searchParams } = new URL(request.url)
    const all = searchParams.get("all") === "true"
    const canViewAll = ADMIN_LIKE_ROLES.includes(profile?.role || "")

    if (all && !canViewAll) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let query = supabase
      .from("leave_requests")
      .select(
        `
        *,
        user:profiles!leave_requests_user_id_profiles_fkey(id, full_name, company_email),
        reliever:profiles!leave_requests_reliever_id_fkey(id, full_name, company_email),
        supervisor:profiles!leave_requests_supervisor_id_fkey(id, full_name, company_email),
        leave_type:leave_types!leave_requests_leave_type_id_fkey(id, name)
      `
      )
      .in("status", ["pending", "pending_evidence"])
      .order("created_at", { ascending: true })

    if (!all) {
      query = query.eq("current_approver_user_id", user.id)
    }

    const { data: requests, error } = await query

    if (error) {
      return NextResponse.json({ error: `Failed to fetch approval queue: ${error.message}` }, { status: 500 })
    }

    const requestIds = Array.from(new Set((requests || []).map((row: any) => row.id).filter(Boolean))) as string[]
    const approverIds = Array.from(
      new Set((requests || []).map((row: any) => row.current_approver_user_id).filter(Boolean))
    ) as string[]

    const approverMap = new Map<string, any>()
    if (approverIds.length > 0) {
      const { data: approverRows } = await supabase
        .from("profiles")
        .select("id, full_name, company_email, role")
        .in("id", approverIds)
      for (const approver of approverRows || []) {
        approverMap.set(approver.id, approver)
      }
    }

    const approvalsByRequest = new Map<string, any[]>()
    if (requestIds.length > 0) {
      const { data: approvalRows, error: approvalError } = await supabase
        .from("leave_approvals")
        .select(
          "id, leave_request_id, approver_id, approval_level, status, comments, approved_at, stage_code, stage_order, reliever_revision, superseded"
        )
        .in("leave_request_id", requestIds)
        .order("approved_at", { ascending: false })

      if (approvalError) {
        return NextResponse.json(
          { error: `Failed to fetch approval history: ${approvalError.message}` },
          { status: 500 }
        )
      }

      const approvalApproverIds = Array.from(
        new Set((approvalRows || []).map((row: any) => row.approver_id).filter(Boolean))
      )
      const approvalApproverMap = new Map<string, any>()
      if (approvalApproverIds.length > 0) {
        const { data: approvalApproverRows } = await supabase
          .from("profiles")
          .select("id, full_name, company_email")
          .in("id", approvalApproverIds)
        for (const row of approvalApproverRows || []) {
          approvalApproverMap.set(row.id, row)
        }
      }

      for (const approval of approvalRows || []) {
        const rows = approvalsByRequest.get(approval.leave_request_id) || []
        rows.push({
          ...approval,
          approver: approval.approver_id ? approvalApproverMap.get(approval.approver_id) || null : null,
        })
        approvalsByRequest.set(approval.leave_request_id, rows)
      }
    }

    const { data: slaRows } = await supabase
      .from("approval_sla_policies")
      .select("stage, due_hours, reminder_hours_before")
      .eq("is_active", true)

    const slaMap = new Map((slaRows || []).map((row: any) => [row.stage, row]))

    const now = Date.now()
    const enriched = await Promise.all(
      (requests || []).map(async (item: any) => {
        try {
          const stageCode = item.current_stage_code || item.approval_stage
          const slaStage = LEGACY_SLA_STAGE_MAP[stageCode] || "reliever_pending"

          const policy = slaMap.get(slaStage) || { due_hours: 24, reminder_hours_before: 4 }
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
            approvals: approvalsByRequest.get(item.id) || [],
            current_approver: item.current_approver_user_id
              ? approverMap.get(item.current_approver_user_id) || null
              : null,
            required_documents: requiredDocs,
            evidence_complete: evidenceStatus.complete,
            missing_documents: evidenceStatus.missing,
            sla: {
              due_at: new Date(dueAt).toISOString(),
              due_status: dueStatus,
              hours_remaining: Math.floor(remainingMs / (1000 * 60 * 60)),
            },
          }
        } catch (itemError: any) {
          return {
            ...item,
            approvals: approvalsByRequest.get(item.id) || [],
            current_approver: item.current_approver_user_id
              ? approverMap.get(item.current_approver_user_id) || null
              : null,
            required_documents: [],
            evidence_complete: true,
            missing_documents: [],
            sla: null,
            queue_enrichment_error: itemError?.message || "Queue enrichment failed",
          }
        }
      })
    )

    const { data: historyApprovals, error: historyError } = await supabase
      .from("leave_approvals")
      .select(
        "id, leave_request_id, approver_id, approval_level, status, comments, approved_at, stage_code, stage_order, reliever_revision, superseded"
      )
      .eq("approver_id", user.id)
      .order("approved_at", { ascending: false })
      .limit(20)

    if (historyError) {
      return NextResponse.json(
        { error: `Failed to fetch your approval activity: ${historyError.message}` },
        { status: 500 }
      )
    }

    const historyRequestIds = Array.from(
      new Set((historyApprovals || []).map((row: any) => row.leave_request_id).filter(Boolean))
    )
    const historyRequestMap = new Map<string, any>()
    const historyApprovalsByRequest = new Map<string, any[]>()
    if (historyRequestIds.length > 0) {
      const { data: historyRequests } = await supabase
        .from("leave_requests")
        .select(
          `
          *,
          user:profiles!leave_requests_user_id_profiles_fkey(id, full_name, company_email),
          reliever:profiles!leave_requests_reliever_id_fkey(id, full_name, company_email),
          supervisor:profiles!leave_requests_supervisor_id_fkey(id, full_name, company_email),
          leave_type:leave_types!leave_requests_leave_type_id_fkey(id, name)
        `
        )
        .in("id", historyRequestIds)

      const { data: historyRequestApprovals } = await supabase
        .from("leave_approvals")
        .select(
          "id, leave_request_id, approver_id, approval_level, status, comments, approved_at, stage_code, stage_order, reliever_revision, superseded"
        )
        .in("leave_request_id", historyRequestIds)
        .order("approved_at", { ascending: false })

      const historyApproverIds = Array.from(
        new Set((historyRequestApprovals || []).map((row: any) => row.approver_id).filter(Boolean))
      )
      const historyApproverMap = new Map<string, any>()
      if (historyApproverIds.length > 0) {
        const { data: historyApproverRows } = await supabase
          .from("profiles")
          .select("id, full_name, company_email")
          .in("id", historyApproverIds)
        for (const row of historyApproverRows || []) {
          historyApproverMap.set(row.id, row)
        }
      }

      for (const approval of historyRequestApprovals || []) {
        const rows = historyApprovalsByRequest.get(approval.leave_request_id) || []
        rows.push({
          ...approval,
          approver: approval.approver_id ? historyApproverMap.get(approval.approver_id) || null : null,
        })
        historyApprovalsByRequest.set(approval.leave_request_id, rows)
      }

      for (const row of historyRequests || []) {
        historyRequestMap.set(row.id, {
          ...row,
          approvals: historyApprovalsByRequest.get(row.id) || [],
        })
      }
    }

    const history = (historyApprovals || []).map((approval: any) => ({
      ...approval,
      request: historyRequestMap.get(approval.leave_request_id) || null,
    }))

    return NextResponse.json({ data: enriched, history })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/hr/leave/queue:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
