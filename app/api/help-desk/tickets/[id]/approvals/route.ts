import { NextRequest, NextResponse } from "next/server"
import {
  appendAuditLog,
  appendHelpDeskEvent,
  canLeadDepartment,
  getAuthContext,
  isAdminRole,
} from "@/lib/help-desk/server"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"

const STAGE_ORDER = ["department_lead", "head_corporate_services", "managing_director"] as const

function nextStage(currentStage: string) {
  const idx = STAGE_ORDER.indexOf(currentStage as (typeof STAGE_ORDER)[number])
  if (idx < 0 || idx === STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
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

    const pendingApproval = (approvals || []).find((a: any) => a.status === "pending")
    if (!pendingApproval) {
      return NextResponse.json({ error: "No pending approval for this ticket" }, { status: 400 })
    }

    const canApproveStage =
      isAdminRole(profile.role) ||
      (pendingApproval.approval_stage === "department_lead" && canLeadDepartment(profile, ticket.service_department)) ||
      (pendingApproval.approval_stage === "head_corporate_services" &&
        ["admin", "super_admin", "lead"].includes(profile.role) &&
        (profile.department === "Admin & HR" || (profile.lead_departments || []).includes("Admin & HR"))) ||
      (pendingApproval.approval_stage === "managing_director" &&
        ["super_admin", "admin"].includes(profile.role) &&
        (profile.department === "Executive Management" || profile.role === "super_admin"))

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
      await supabase.from("help_desk_tickets").update({ status: "rejected" }).eq("id", ticket.id)

      await supabase.rpc("create_notification", {
        p_user_id: ticket.requester_id,
        p_type: "approval_rejected",
        p_category: "approvals",
        p_title: "Procurement request rejected",
        p_message: `${ticket.ticket_number} was rejected at ${pendingApproval.approval_stage}`,
        p_priority: "high",
        p_link_url: "/portal/help-desk",
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: ticket.id,
        p_rich_content: { approval_stage: pendingApproval.approval_stage, comments: comments || null },
      })

      try {
        await sendHelpDeskMail({
          userIds: [ticket.requester_id, ticket.assigned_to].filter(Boolean) as string[],
          subject: `Procurement Rejected: ${ticket.ticket_number}`,
          title: "Ticket Procurement Request Rejected",
          message: `${ticket.title} was rejected at ${pendingApproval.approval_stage}. Review and update the request.`,
          ticketNumber: ticket.ticket_number,
        })
      } catch (mailError) {
        console.error("Help desk mail error (rejected):", mailError)
      }
    } else {
      const upcomingStage = nextStage(pendingApproval.approval_stage)

      if (!upcomingStage) {
        finalStatus = "approved_for_procurement"
        await supabase
          .from("help_desk_tickets")
          .update({
            status: "approved_for_procurement",
            resumed_at: now,
            paused_at: null,
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
            p_link_url: "/portal/help-desk",
            p_actor_id: user.id,
            p_entity_type: "help_desk_ticket",
            p_entity_id: ticket.id,
            p_rich_content: { final_stage: pendingApproval.approval_stage },
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
          .select("id, role, department, lead_departments")

        const nextApprover = (potentialApprovers || []).find((p: any) => {
          if (upcomingStage === "head_corporate_services") {
            return (
              ["admin", "super_admin", "lead"].includes(p.role) &&
              (p.department === "Admin & HR" || (p.lead_departments || []).includes("Admin & HR"))
            )
          }

          return (
            ["super_admin", "admin"].includes(p.role) &&
            (p.department === "Executive Management" || p.role === "super_admin")
          )
        })

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
        stage: pendingApproval.approval_stage,
        decision: normalizedDecision,
        comments: comments || null,
      },
    })

    await appendAuditLog({
      actorId: user.id,
      action: `help_desk_approval_${normalizedDecision}`,
      entityId: ticket.id,
      newValues: {
        approval_stage: pendingApproval.approval_stage,
        decision: normalizedDecision,
        status: finalStatus,
      },
    })

    return NextResponse.json({
      data: {
        ticket_id: ticket.id,
        approval_stage: pendingApproval.approval_stage,
        decision: normalizedDecision,
        status: finalStatus,
      },
    })
  } catch (error) {
    console.error("Error in POST /api/help-desk/tickets/[id]/approvals:", error)
    return NextResponse.json({ error: "Failed to process approval decision" }, { status: 500 })
  }
}
