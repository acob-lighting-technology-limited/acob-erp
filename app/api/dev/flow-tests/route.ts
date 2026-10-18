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
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { toLocalISODate } from "@/lib/utils/date"

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

type DevProfileRow = {
  id: string
  full_name?: string | null
  department?: string | null
  role?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
  employment_status?: string | null
}

type DevRequesterRow = {
  id: string
  full_name?: string | null
  department?: string | null
}

type DevTicketRow = {
  id: string
  ticket_number?: string | null
}

type DevStatusRow = {
  status?: string | null
}

type DevTaskRow = {
  id: string
}

type TestFlowBody = {
  cleanup?: boolean
  requester_id?: string
  service_department?: string
  request_type?: string
  support_mode?: string
  assigner_id?: string
  assignee_id?: string
  kind?: string
}

async function testHelpDesk(admin: SupabaseClient, body: TestFlowBody): Promise<{ ok: boolean; steps: StepResult[] }> {
  const steps: StepResult[] = []
  let ticketId: string | null = null
  const cleanup = body.cleanup !== false
  const db = admin as unknown as SupabaseClient

  try {
    const { requester_id, service_department } = body
    const supportMode = body.support_mode === "lead_review_required" ? "lead_review_required" : "open_queue"
    if (!requester_id || !service_department) {
      steps.push(err("validate_input", "requester_id and service_department are required"))
      return { ok: false, steps }
    }

    // Step 1: Load requester
    const { data: requester, error: reqErr } = await db
      .from("profiles")
      .select("id, full_name, department")
      .eq("id", requester_id)
      .single()
    const typedRequester = requester as DevRequesterRow | null
    if (reqErr || !typedRequester) {
      steps.push(err("load_requester", reqErr?.message || "Not found"))
      return { ok: false, steps }
    }
    steps.push(ok("load_requester", `Loaded: ${typedRequester.full_name || typedRequester.id}`))

    // Step 2: Create a test ticket for the selected flow.
    const now = new Date()
    const slaTarget = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const { data: ticket, error: ticketErr } = await db
      .from("help_desk_tickets")
      .insert({
        title: "[TEST] Automated help desk flow test",
        description: "Automated test ticket — safe to delete",
        service_department,
        request_type: "support",
        priority: "medium",
        status: supportMode === "lead_review_required" ? "pending_lead_review" : "department_queue",
        requester_id,
        created_by: requester_id,
        approval_required: false,
        support_mode: supportMode,
        handling_mode: "queue",
        requester_department: typedRequester.department || null,
        submitted_at: now.toISOString(),
        sla_target_at: slaTarget,
        paused_at: null,
      })
      .select()
      .single()

    const typedTicket = ticket as DevTicketRow | null
    if (ticketErr || !typedTicket) {
      steps.push(err("create_ticket", ticketErr?.message || "Insert returned no data"))
      return { ok: false, steps }
    }
    ticketId = typedTicket.id
    steps.push(ok("create_ticket", `Created ticket #${typedTicket.ticket_number || typedTicket.id}`))

    // Step 3: Find department lead
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, role, is_department_lead, lead_departments, department, employment_status")

    const activeProfiles = ((profiles || []) as DevProfileRow[]).filter((profile) =>
      isAssignableEmploymentStatus(profile.employment_status, { allowLegacyNullStatus: false })
    )

    const lead = activeProfiles.find((p) => {
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

    if (supportMode === "lead_review_required") {
      if (lead) {
        const { error: releaseErr } = await db
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
      const { error: assignErr } = await db
        .from("help_desk_tickets")
        .update({ assigned_to: lead.id, status: "in_progress", handling_mode: "individual" })
        .eq("id", ticketId)
      if (assignErr) steps.push(err("assign_ticket", assignErr.message))
      else steps.push(ok("assign_ticket", `Assigned to ${lead.full_name}`))
    }

    // Step 5: Close ticket
    const { error: closeErr } = await db
      .from("help_desk_tickets")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", ticketId)
    if (closeErr) steps.push(err("resolve_ticket", closeErr.message))
    else steps.push(ok("resolve_ticket", "Ticket marked resolved"))

    // Step 6: Verify
    const { data: final } = await db.from("help_desk_tickets").select("status").eq("id", ticketId).single()
    const finalTicket = final as DevStatusRow | null
    if (finalTicket?.status === "resolved") steps.push(ok("verify_final_state", "status=resolved ✓"))
    else steps.push(err("verify_final_state", `Expected resolved, got ${finalTicket?.status}`))

    // Cleanup
    if (cleanup && ticketId) {
      try {
        await db.from("help_desk_tickets").delete().eq("id", ticketId)
      } catch {
        /* ignore */
      }
      steps.push(ok("cleanup", `Deleted test ticket ${ticketId}`))
    }

    return { ok: steps.every((s) => s.status !== "error"), steps }
  } catch (e: unknown) {
    if (cleanup && ticketId) {
      try {
        await db.from("help_desk_tickets").delete().eq("id", ticketId)
      } catch {
        /* ignore */
      }
    }
    return { ok: false, steps: [...steps, err("unexpected", e instanceof Error ? e.message : "Unknown error")] }
  }
}

async function testTask(admin: SupabaseClient, body: TestFlowBody): Promise<{ ok: boolean; steps: StepResult[] }> {
  const steps: StepResult[] = []
  let taskId: string | null = null
  const cleanup = body.cleanup !== false
  const db = admin as unknown as SupabaseClient

  try {
    const { assigner_id, assignee_id } = body
    if (!assigner_id || !assignee_id) {
      steps.push(err("validate_input", "assigner_id and assignee_id are required"))
      return { ok: false, steps }
    }

    // Step 1: Load assigner
    const { data: assigner } = await db
      .from("profiles")
      .select("id, full_name, department")
      .eq("id", assigner_id)
      .single()
    const typedAssigner = assigner as DevRequesterRow | null
    steps.push(
      typedAssigner ? ok("load_assigner", `Loaded: ${typedAssigner.full_name}`) : err("load_assigner", "Not found")
    )
    if (!typedAssigner) return { ok: false, steps }

    // Step 2: Load assignee
    const { data: assignee } = await db
      .from("profiles")
      .select("id, full_name, department")
      .eq("id", assignee_id)
      .single()
    const typedAssignee = assignee as DevRequesterRow | null
    steps.push(
      typedAssignee ? ok("load_assignee", `Loaded: ${typedAssignee.full_name}`) : err("load_assignee", "Not found")
    )
    if (!typedAssignee) return { ok: false, steps }

    // Step 3: Create task
    const due = toLocalISODate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .insert({
        title: "[TEST] Automated task flow test",
        description: "Automated test task — safe to delete",
        priority: "medium",
        status: "pending",
        assigned_to: assignee_id,
        assigned_by: assigner_id,
        department: typedAssignee.department || null,
        due_date: due,
        assignment_type: "individual",
      })
      .select()
      .single()

    const typedTask = task as DevTaskRow | null
    if (taskErr || !typedTask) {
      steps.push(err("create_task", taskErr?.message || "Insert returned no data"))
      return { ok: false, steps }
    }
    taskId = typedTask.id
    steps.push(ok("create_task", `Created task ${typedTask.id}`))

    // Step 4: Move to in_progress
    const { error: startErr } = await db.from("tasks").update({ status: "in_progress" }).eq("id", taskId)
    if (startErr) steps.push(err("start_task", startErr.message))
    else steps.push(ok("start_task", "Status → in_progress"))

    // Step 5: Complete task
    const { error: completeErr } = await db
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId)
    if (completeErr) steps.push(err("complete_task", completeErr.message))
    else steps.push(ok("complete_task", "Status → completed"))

    // Step 6: Verify
    const { data: final } = await db.from("tasks").select("status").eq("id", taskId).single()
    const finalTask = final as DevStatusRow | null
    if (finalTask?.status === "completed") steps.push(ok("verify_final_state", "status=completed ✓"))
    else steps.push(err("verify_final_state", `Expected completed, got ${finalTask?.status}`))

    // Cleanup
    if (cleanup && taskId) {
      try {
        await db.from("tasks").delete().eq("id", taskId)
      } catch {
        /* ignore */
      }
      steps.push(ok("cleanup", `Deleted test task ${taskId}`))
    }

    return { ok: steps.every((s) => s.status !== "error"), steps }
  } catch (e: unknown) {
    if (cleanup && taskId) {
      try {
        await db.from("tasks").delete().eq("id", taskId)
      } catch {
        /* ignore */
      }
    }
    return { ok: false, steps: [...steps, err("unexpected", e instanceof Error ? e.message : "Unknown error")] }
  }
}

export async function PATCH(request: NextRequest) {
  const rl = await rateLimit(`dev-flow-tests:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

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

// POST kept for backwards compat — prefer PATCH
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`dev-flow-tests:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  return PATCH(request)
}
