/**
 * POST /api/dev/help-desk-test
 * POST /api/dev/task-test
 *
 * Both live in this single route for simplicity.
 * Path: /api/dev/flow-tests
 *
 * Body: { kind: "help_desk" | "task", ...params }
 * Protected: developer role only.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"

type StepResult = {
  step: string
  status: "ok" | "error" | "skipped"
  detail?: string
  data?: unknown
}

function ok(step: string, detail?: string, data?: unknown): StepResult {
  return { step, status: "ok", detail, data }
}
function err(step: string, detail: string): StepResult {
  return { step, status: "error", detail }
}

async function testHelpDesk(admin: any, body: any): Promise<{ ok: boolean; steps: StepResult[] }> {
  const steps: StepResult[] = []
  let ticketId: string | null = null
  const cleanup = body.cleanup !== false

  try {
    const { requester_id, service_department } = body
    const requestType = body.request_type === "procurement" ? "procurement" : "support"
    const supportMode = body.support_mode === "lead_review_required" ? "lead_review_required" : "open_queue"
    if (!requester_id || !service_department) {
      steps.push(err("validate_input", "requester_id and service_department are required"))
      return { ok: false, steps }
    }

    // Step 1: Load requester
    const { data: requester, error: reqErr } = await admin
      .from("profiles")
      .select("id, full_name, department")
      .eq("id", requester_id)
      .single()
    if (reqErr || !requester) {
      steps.push(err("load_requester", reqErr?.message || "Not found"))
      return { ok: false, steps }
    }
    steps.push(ok("load_requester", `Loaded: ${requester.full_name || requester.id}`))

    // Step 2: Create a test ticket for the selected flow.
    const now = new Date()
    const slaTarget = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const { data: ticket, error: ticketErr } = await admin
      .from("help_desk_tickets")
      .insert({
        title: "[TEST] Automated help desk flow test",
        description: "Automated test ticket — safe to delete",
        service_department,
        request_type: requestType,
        priority: "medium",
        status:
          requestType === "procurement"
            ? "pending_approval"
            : supportMode === "lead_review_required"
              ? "pending_lead_review"
              : "department_queue",
        requester_id,
        created_by: requester_id,
        approval_required: requestType === "procurement",
        support_mode: requestType === "support" ? supportMode : null,
        handling_mode: requestType === "support" ? "queue" : "individual",
        requester_department: requester.department || null,
        submitted_at: now.toISOString(),
        sla_target_at: slaTarget,
        paused_at: requestType === "procurement" ? now.toISOString() : null,
      })
      .select()
      .single()

    if (ticketErr || !ticket) {
      steps.push(err("create_ticket", ticketErr?.message || "Insert returned no data"))
      return { ok: false, steps }
    }
    ticketId = ticket.id
    steps.push(ok("create_ticket", `Created ticket #${ticket.ticket_number || ticket.id}`))

    if (requestType === "procurement") {
      const { error: approvalSeedErr } = await admin.from("help_desk_approvals").insert([
        { ticket_id: ticketId, approval_stage: "department_lead", status: "pending" },
        { ticket_id: ticketId, approval_stage: "head_corporate_services", status: "pending" },
        { ticket_id: ticketId, approval_stage: "managing_director", status: "pending" },
      ])

      if (approvalSeedErr) {
        steps.push(err("seed_procurement_stages", approvalSeedErr.message))
        return { ok: false, steps }
      }
      steps.push(ok("seed_procurement_stages", "Seeded department lead, HCS, and MD approval stages"))
    }

    // Step 3: Find department lead
    const { data: profiles } = await applyAssignableStatusFilter(
      admin.from("profiles").select("id, full_name, role, is_department_lead, lead_departments, department"),
      { allowLegacyNullStatus: false }
    )

    const lead = (profiles || []).find((p: any) => {
      const managed = Array.isArray(p.lead_departments) ? p.lead_departments : []
      return p.is_department_lead && (p.department === service_department || managed.includes(service_department))
    })

    if (lead) {
      steps.push(ok("find_dept_lead", `Found: ${lead.full_name || lead.id}`))
    } else {
      steps.push({
        step: "find_dept_lead",
        status: "skipped",
        detail: `No department lead configured for "${service_department}" — ticket would appear unassigned`,
      })
    }

    if (requestType === "support") {
      if (supportMode === "lead_review_required") {
        if (lead) {
          const { error: releaseErr } = await admin
            .from("help_desk_tickets")
            .update({ status: "department_queue", handling_mode: "queue" })
            .eq("id", ticketId)
          if (releaseErr) steps.push(err("lead_release_to_queue", releaseErr.message))
          else
            steps.push(
              ok("lead_release_to_queue", `${lead.full_name || lead.id} released the ticket to department queue`)
            )
        } else {
          steps.push(err("lead_release_to_queue", `No department lead configured for "${service_department}"`))
        }
      } else {
        steps.push(ok("queue_entry", "Ticket entered department queue directly"))
      }

      // Step 4: Assign ticket to lead
      if (lead) {
        const { error: assignErr } = await admin
          .from("help_desk_tickets")
          .update({ assigned_to: lead.id, status: "in_progress", handling_mode: "individual" })
          .eq("id", ticketId)
        if (assignErr) steps.push(err("assign_ticket", assignErr.message))
        else steps.push(ok("assign_ticket", `Assigned to ${lead.full_name}`))
      }

      // Step 5: Close ticket
      const { error: closeErr } = await admin
        .from("help_desk_tickets")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", ticketId)
      if (closeErr) steps.push(err("resolve_ticket", closeErr.message))
      else steps.push(ok("resolve_ticket", "Ticket marked resolved"))

      // Step 6: Verify
      const { data: final } = await admin.from("help_desk_tickets").select("status").eq("id", ticketId).single()
      if (final?.status === "resolved") steps.push(ok("verify_final_state", "status=resolved ✓"))
      else steps.push(err("verify_final_state", `Expected resolved, got ${final?.status}`))
    } else {
      const requesterLead = (profiles || []).find((p: any) => {
        const managed = Array.isArray(p.lead_departments) ? p.lead_departments : []
        return p.is_department_lead && (p.department === requester.department || managed.includes(requester.department))
      })
      const serviceLead = lead
      const hcs = (profiles || []).find((p: any) => {
        const managed = Array.isArray(p.lead_departments) ? p.lead_departments : []
        return (
          (["developer", "admin", "super_admin"].includes(p.role) || p.is_department_lead) &&
          (p.department === "Corporate Services" || managed.includes("Corporate Services"))
        )
      })
      const md = (profiles || []).find((p: any) => {
        return (
          (["developer", "admin", "super_admin"].includes(p.role) && p.department === "Executive Management") ||
          p.role === "developer" ||
          p.role === "super_admin"
        )
      })

      if (requesterLead) {
        const { error: deptApproveErr } = await admin
          .from("help_desk_approvals")
          .update({
            status: "approved",
            approver_id: requesterLead.id,
            comments: "[TEST] Requester lead approved",
            decided_at: new Date().toISOString(),
          })
          .eq("ticket_id", ticketId)
          .eq("approval_stage", "requester_department_lead")
        if (deptApproveErr) steps.push(err("approve_requester_department_lead", deptApproveErr.message))
        else
          steps.push(
            ok(
              "approve_requester_department_lead",
              `${requesterLead.full_name || requesterLead.id} approved requester lead stage`
            )
          )
      } else {
        steps.push(
          err(
            "approve_requester_department_lead",
            `No requester department lead configured for "${requester.department}"`
          )
        )
      }

      if (serviceLead) {
        const { error: serviceApproveErr } = await admin
          .from("help_desk_approvals")
          .update({
            status: "approved",
            approver_id: serviceLead.id,
            comments: "[TEST] Service lead approved",
            decided_at: new Date().toISOString(),
          })
          .eq("ticket_id", ticketId)
          .eq("approval_stage", "service_department_lead")
        if (serviceApproveErr) steps.push(err("approve_service_department_lead", serviceApproveErr.message))
        else
          steps.push(
            ok(
              "approve_service_department_lead",
              `${serviceLead.full_name || serviceLead.id} approved service lead stage`
            )
          )
      } else {
        steps.push(
          err("approve_service_department_lead", `No service department lead configured for "${service_department}"`)
        )
      }

      if (hcs) {
        const { error: hcsApproveErr } = await admin
          .from("help_desk_approvals")
          .update({
            status: "approved",
            approver_id: hcs.id,
            comments: "[TEST] HCS approved",
            decided_at: new Date().toISOString(),
          })
          .eq("ticket_id", ticketId)
          .eq("approval_stage", "head_corporate_services")
        if (hcsApproveErr) steps.push(err("approve_head_corporate_services", hcsApproveErr.message))
        else steps.push(ok("approve_head_corporate_services", `${hcs.full_name || hcs.id} approved HCS stage`))
      } else {
        steps.push(err("approve_head_corporate_services", "No Corporate Services approver configured"))
      }

      if (md) {
        const { error: mdApproveErr } = await admin
          .from("help_desk_approvals")
          .update({
            status: "approved",
            approver_id: md.id,
            comments: "[TEST] MD approved",
            decided_at: new Date().toISOString(),
          })
          .eq("ticket_id", ticketId)
          .eq("approval_stage", "managing_director")
        if (mdApproveErr) steps.push(err("approve_managing_director", mdApproveErr.message))
        else steps.push(ok("approve_managing_director", `${md.full_name || md.id} approved MD stage`))
      } else {
        steps.push(err("approve_managing_director", "No managing director approver configured"))
      }

      const { error: finaliseErr } = await admin
        .from("help_desk_tickets")
        .update({
          status: "approved_for_procurement",
          resumed_at: new Date().toISOString(),
          paused_at: null,
        })
        .eq("id", ticketId)
      if (finaliseErr) {
        steps.push(err("finalise_procurement", finaliseErr.message))
      } else {
        steps.push(ok("finalise_procurement", "Ticket advanced to approved_for_procurement"))
      }

      const { data: final } = await admin.from("help_desk_tickets").select("status").eq("id", ticketId).single()
      if (final?.status === "approved_for_procurement") {
        steps.push(ok("verify_final_state", "status=approved_for_procurement ✓"))
      } else {
        steps.push(err("verify_final_state", `Expected approved_for_procurement, got ${final?.status}`))
      }
    }

    // Cleanup
    if (cleanup && ticketId) {
      try {
        await admin.from("help_desk_tickets").delete().eq("id", ticketId)
      } catch {
        /* ignore */
      }
      steps.push(ok("cleanup", `Deleted test ticket ${ticketId}`))
    }

    return { ok: steps.every((s) => s.status !== "error"), steps }
  } catch (e: any) {
    if (cleanup && ticketId) {
      try {
        await admin.from("help_desk_tickets").delete().eq("id", ticketId)
      } catch {
        /* ignore */
      }
    }
    return { ok: false, steps: [...steps, err("unexpected", e.message)] }
  }
}

async function testTask(admin: any, body: any): Promise<{ ok: boolean; steps: StepResult[] }> {
  const steps: StepResult[] = []
  let taskId: string | null = null
  const cleanup = body.cleanup !== false

  try {
    const { assigner_id, assignee_id } = body
    if (!assigner_id || !assignee_id) {
      steps.push(err("validate_input", "assigner_id and assignee_id are required"))
      return { ok: false, steps }
    }

    // Step 1: Load assigner
    const { data: assigner } = await admin
      .from("profiles")
      .select("id, full_name, department")
      .eq("id", assigner_id)
      .single()
    steps.push(assigner ? ok("load_assigner", `Loaded: ${assigner.full_name}`) : err("load_assigner", "Not found"))
    if (!assigner) return { ok: false, steps }

    // Step 2: Load assignee
    const { data: assignee } = await admin
      .from("profiles")
      .select("id, full_name, department")
      .eq("id", assignee_id)
      .single()
    steps.push(assignee ? ok("load_assignee", `Loaded: ${assignee.full_name}`) : err("load_assignee", "Not found"))
    if (!assignee) return { ok: false, steps }

    // Step 3: Create task
    const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: task, error: taskErr } = await admin
      .from("tasks")
      .insert({
        title: "[TEST] Automated task flow test",
        description: "Automated test task — safe to delete",
        priority: "medium",
        status: "pending",
        assigned_to: assignee_id,
        assigned_by: assigner_id,
        department: assignee.department || null,
        due_date: due,
        assignment_type: "individual",
      })
      .select()
      .single()

    if (taskErr || !task) {
      steps.push(err("create_task", taskErr?.message || "Insert returned no data"))
      return { ok: false, steps }
    }
    taskId = task.id
    steps.push(ok("create_task", `Created task ${task.id}`))

    // Step 4: Move to in_progress
    const { error: startErr } = await admin.from("tasks").update({ status: "in_progress" }).eq("id", taskId)
    if (startErr) steps.push(err("start_task", startErr.message))
    else steps.push(ok("start_task", "Status → in_progress"))

    // Step 5: Complete task
    const { error: completeErr } = await admin
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId)
    if (completeErr) steps.push(err("complete_task", completeErr.message))
    else steps.push(ok("complete_task", "Status → completed"))

    // Step 6: Verify
    const { data: final } = await admin.from("tasks").select("status").eq("id", taskId).single()
    if (final?.status === "completed") steps.push(ok("verify_final_state", "status=completed ✓"))
    else steps.push(err("verify_final_state", `Expected completed, got ${final?.status}`))

    // Cleanup
    if (cleanup && taskId) {
      try {
        await admin.from("tasks").delete().eq("id", taskId)
      } catch {
        /* ignore */
      }
      steps.push(ok("cleanup", `Deleted test task ${taskId}`))
    }

    return { ok: steps.every((s) => s.status !== "error"), steps }
  } catch (e: any) {
    if (cleanup && taskId) {
      try {
        await admin.from("tasks").delete().eq("id", taskId)
      } catch {
        /* ignore */
      }
    }
    return { ok: false, steps: [...steps, err("unexpected", e.message)] }
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (p?.role !== "developer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey)
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 })

  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const body = await request.json()

  if (body.kind === "help_desk") {
    const result = await testHelpDesk(admin, body)
    return NextResponse.json(result)
  }

  if (body.kind === "task") {
    const result = await testTask(admin, body)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "kind must be 'help_desk' or 'task'" }, { status: 400 })
}
