import { NextRequest, NextResponse } from "next/server"
import {
  appendAuditLog,
  appendHelpDeskEvent,
  getAuthContext,
  resolveLeadForDepartment,
} from "@/lib/help-desk/server"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"

const STAGE_ORDER = [
  "requester_department_lead",
  "service_department_lead",
  "head_corporate_services",
  "managing_director",
] as const

function nextStage(currentStage: string) {
  const idx = STAGE_ORDER.indexOf(currentStage as (typeof STAGE_ORDER)[number])
  if (idx < 0 || idx === STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

function managesDepartmentStrict(profile: any, department: string | null | undefined) {
  if (!profile?.is_department_lead || !department) return false
  const managedDepartments = Array.isArray(profile?.managed_departments)
    ? profile.managed_departments
    : Array.isArray(profile?.lead_departments)
      ? profile.lead_departments
      : []
  return managedDepartments.includes(department) || profile?.department === department
}

function normalizeApprovalStage(stage: string | null | undefined) {
  if (!stage) return ""
  if (stage === "department_lead") return "service_department_lead"
  return stage
}

function stageRank(stage: string) {
  const normalized = normalizeApprovalStage(stage)
  const rank = STAGE_ORDER.indexOf(normalized as (typeof STAGE_ORDER)[number])
  return rank >= 0 ? rank : Number.MAX_SAFE_INTEGER
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { decision, comments } = await request.json()
    const normalizedDecision = String(decision || "").toLowerCase()

    if (!["approved", "rejected"].includes(normalizedDecision)) {
      return NextResponse.json({ error: 'decision must be "approved" or "rejected"' }, { status: 400 })
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const { data: approvals, error: approvalsError } = await supabase
      .from("help_desk_approvals")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("requested_at", { ascending: true })

    if (approvalsError) throw approvalsError

    const pendingApproval =
      (approvals || [])
        .filter((a: any) => a.status === "pending")
        .sort((a: any, b: any) => stageRank(a.approval_stage) - stageRank(b.approval_stage))[0] || null
    if (!pendingApproval) {
      return NextResponse.json({ error: "No pending approval for this ticket" }, { status: 400 })
    }
    const approvalStage = normalizeApprovalStage(pendingApproval.approval_stage)

    const canApproveStage =
      (approvalStage === "requester_department_lead" &&
        managesDepartmentStrict(profile, ticket.requester_department)) ||
      (approvalStage === "service_department_lead" &&
        managesDepartmentStrict(profile, ticket.service_department)) ||
      (approvalStage === "head_corporate_services" &&
        managesDepartmentStrict(profile, "Corporate Services")) ||
      (approvalStage === "managing_director" &&
        managesDepartmentStrict(profile, "Executive Management"))

    if (!canApproveStage) {
      return NextResponse.json({ error: "You are not authorized to decide this approval stage" }, { status: 403 })
    }

    const now = new Date().toISOString()

    const { error: updateApprovalError } = await supabase
      .from("help_desk_approvals")
      .update({
        status: normalizedDecision,
        approver_id: user.id,
        comments: comments ? String(comments) : null,
        decided_at: now,
      })
      .eq("id", pendingApproval.id)

    if (updateApprovalError) throw updateApprovalError

    let finalStatus = ticket.status

    if (normalizedDecision === "rejected") {
      finalStatus = "rejected"
      await supabase
        .from("help_desk_tickets")
        .update({ status: "rejected", current_approval_stage: null })
        .eq("id", ticket.id)

      await supabase.rpc("create_notification", {
        p_user_id: ticket.requester_id,
        p_type: "approval_rejected",
        p_category: "approvals",
        p_title: "Procurement request rejected",
        p_message: `${ticket.ticket_number} was rejected at ${approvalStage}`,
        p_priority: "high",
        p_link_url: "/dashboard/help-desk",
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: ticket.id,
        p_rich_content: { approval_stage: approvalStage, comments: comments || null },
      })

      try {
        await sendHelpDeskMail({
          userIds: [ticket.requester_id, ticket.assigned_to].filter(Boolean) as string[],
          subject: `Procurement Rejected: ${ticket.ticket_number}`,
          title: "Ticket Procurement Request Rejected",
          message: `${ticket.title} was rejected at ${approvalStage}. Review and update the request.`,
          ticketNumber: ticket.ticket_number,
        })
      } catch (mailError) {
        console.error("Help desk mail error (rejected):", mailError)
      }
    } else {
      const upcomingStage = nextStage(approvalStage)

      if (!upcomingStage) {
        finalStatus = "approved_for_procurement"
        await supabase
          .from("help_desk_tickets")
          .update({
            status: "approved_for_procurement",
            resumed_at: now,
            paused_at: null,
            current_approval_stage: null,
          })
          .eq("id", ticket.id)

        const notificationTargets = [ticket.requester_id, ticket.assigned_to].filter(Boolean)
        for (const targetId of notificationTargets) {
          await supabase.rpc("create_notification", {
            p_user_id: targetId,
            p_type: "approval_granted",
            p_category: "approvals",
            p_title: "Procurement approved",
            p_message: `${ticket.ticket_number} has completed all approval stages`,
            p_priority: "normal",
            p_link_url: "/dashboard/help-desk",
            p_actor_id: user.id,
            p_entity_type: "help_desk_ticket",
            p_entity_id: ticket.id,
            p_rich_content: { final_stage: approvalStage },
          })
        }

        try {
          await sendHelpDeskMail({
            userIds: notificationTargets as string[],
            subject: `Procurement Approved: ${ticket.ticket_number}`,
            title: "Ticket Procurement Fully Approved",
            message: `${ticket.title} has passed all approval levels and work can continue.`,
            ticketNumber: ticket.ticket_number,
          })
        } catch (mailError) {
          console.error("Help desk mail error (final approval):", mailError)
        }
      } else {
        finalStatus = "pending_approval"

        const { data: potentialApprovers } = await supabase
          .from("profiles")
          .select("id, full_name, role, department, is_department_lead, lead_departments")
          .or("employment_status.eq.active,employment_status.is.null")

        const nextApprover = ((): any | null => {
          const rows = potentialApprovers || []
          if (upcomingStage === "requester_department_lead") {
            return resolveLeadForDepartment(rows, ticket.requester_department)
          }
          if (upcomingStage === "service_department_lead") {
            return resolveLeadForDepartment(rows, ticket.service_department)
          }
          if (upcomingStage === "head_corporate_services") {
            return (
              rows.find((p: any) => {
                return p.is_department_lead && (p.department === "Corporate Services" || (p.lead_departments || []).includes("Corporate Services"))
              }) || null
            )
          }
          return (
            rows.find((p: any) => {
              return p.is_department_lead && (p.department === "Executive Management" || (p.lead_departments || []).includes("Executive Management"))
            }) || null
          )
        })()

        await supabase.from("help_desk_tickets").update({ current_approval_stage: upcomingStage }).eq("id", ticket.id)

        if (nextApprover?.id) {
          await supabase.rpc("create_notification", {
            p_user_id: nextApprover.id,
            p_type: "approval_request",
            p_category: "approvals",
            p_title: "Procurement approval required",
            p_message: `${ticket.ticket_number} is waiting for ${upcomingStage} approval`,
            p_priority: ticket.priority === "urgent" ? "urgent" : "high",
            p_link_url: "/admin/help-desk",
            p_actor_id: user.id,
            p_entity_type: "help_desk_ticket",
            p_entity_id: ticket.id,
            p_rich_content: { next_stage: upcomingStage },
          })

          try {
            await sendHelpDeskMail({
              userIds: [nextApprover.id],
              subject: `Approval Required: ${ticket.ticket_number}`,
              title: "Procurement Approval Needed",
              message: `${ticket.title} is waiting for your decision at ${upcomingStage}.`,
              ticketNumber: ticket.ticket_number,
              ctaPath: "/admin/help-desk",
            })
          } catch (mailError) {
            console.error("Help desk mail error (next approver):", mailError)
          }
        }
      }
    }

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType: normalizedDecision === "approved" ? "approval_approved" : "approval_rejected",
      oldStatus: ticket.status,
      newStatus: finalStatus,
      details: {
        stage: approvalStage,
        decision: normalizedDecision,
        comments: comments || null,
      },
    })

    await appendAuditLog({
      actorId: user.id,
      action: `help_desk_approval_${normalizedDecision}`,
      entityId: ticket.id,
      department: ticket.service_department,
      route: "/api/help-desk/tickets/[id]/approvals",
      critical: true,
      newValues: {
        approval_stage: approvalStage,
        decision: normalizedDecision,
        status: finalStatus,
      },
    })

    return NextResponse.json({
      data: {
        ticket_id: ticket.id,
        approval_stage: approvalStage,
        decision: normalizedDecision,
        status: finalStatus,
      },
    })
  } catch (error) {
    console.error("Error in POST /api/help-desk/tickets/[id]/approvals:", error)
    return NextResponse.json({ error: "Failed to process approval decision" }, { status: 500 })
  }
}
