/**
 * Seeds visible data for Chibuikem across all routes:
 * /work, /tasks, /help-desk, /leave
 *
 * Run: npx tsx scripts/seed-chibuikem-data.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const USERS = {
  chibuikem:    "1aeae0c5-ef2f-4790-be14-d0e696be01af",
  abdulsamad:   "3791c0f4-dde9-41f8-a227-986273532d9c",
  peter:        "90d64faf-863e-4d07-a500-186cd073fbd8",
  alexander:    "d29aad5f-f382-4998-8bd2-9857435874e0",
  onyekachukwu: "c6d934f4-8d43-4c1c-967e-103c9f49f82a",
  peace:        "b4395c0d-c599-4067-91db-e8b62d43b6b7",
}

async function seed() {
  console.log("Seeding data for Chibuikem...\n")

  // ── 1. HELP DESK TICKETS (Chibuikem as requester and assignee) ──
  console.log("── Help Desk Tickets ──")

  // Clean previous seeds
  await sb.from("help_desk_tickets").delete().ilike("title", "SEED:%")

  const tickets = [
    {
      title: "SEED: Laptop screen flickering intermittently",
      description: "My laptop screen has been flickering since Monday. Tried restarting but issue persists.",
      requester_id: USERS.chibuikem,
      created_by: USERS.chibuikem,
      service_department: "IT and Communications",
      request_type: "support",
      priority: "high",
      status: "in_progress",
      assigned_to: USERS.abdulsamad,
      category: "hardware",
    },
    {
      title: "SEED: Request for second monitor",
      description: "Need a second monitor for design work. 24 inch minimum.",
      requester_id: USERS.chibuikem,
      created_by: USERS.chibuikem,
      service_department: "IT and Communications",
      request_type: "procurement",
      priority: "medium",
      status: "pending_approval",
      category: "equipment",
    },
    {
      title: "SEED: VPN access not working from home",
      description: "Cannot connect to company VPN when working remotely.",
      requester_id: USERS.chibuikem,
      created_by: USERS.chibuikem,
      service_department: "IT and Communications",
      request_type: "support",
      priority: "urgent",
      status: "resolved",
      assigned_to: USERS.abdulsamad,
      category: "network",
    },
    {
      title: "SEED: Network printer not responding on 2nd floor",
      description: "The shared printer on 2nd floor shows offline. Affects whole department.",
      requester_id: USERS.peace,
      created_by: USERS.peace,
      service_department: "IT and Communications",
      request_type: "support",
      priority: "medium",
      status: "department_queue",
      category: "hardware",
    },
    {
      title: "SEED: Software license renewal - Adobe Creative Suite",
      description: "Adobe CS licenses expire next week. Need renewal for 5 seats.",
      requester_id: USERS.alexander,
      created_by: USERS.alexander,
      service_department: "IT and Communications",
      request_type: "procurement",
      priority: "high",
      status: "approved_for_procurement",
      assigned_to: USERS.chibuikem,
      category: "software",
    },
    {
      title: "SEED: Email not syncing on mobile devices",
      description: "Company email stopped syncing on my phone after the server migration.",
      requester_id: USERS.onyekachukwu,
      created_by: USERS.onyekachukwu,
      service_department: "IT and Communications",
      request_type: "support",
      priority: "low",
      status: "new",
      category: "email",
    },
    {
      title: "SEED: Request for standing desk",
      description: "Ergonomic standing desk for improved posture during long coding sessions.",
      requester_id: USERS.chibuikem,
      created_by: USERS.chibuikem,
      service_department: "Admin & HR",
      request_type: "procurement",
      priority: "low",
      status: "rejected",
      category: "furniture",
    },
    {
      title: "SEED: Conference room projector malfunction",
      description: "Projector in main conference room displays blue tint. Board meeting tomorrow.",
      requester_id: USERS.peter,
      created_by: USERS.peter,
      service_department: "IT and Communications",
      request_type: "support",
      priority: "urgent",
      status: "closed",
      assigned_to: USERS.chibuikem,
      category: "hardware",
    },
  ]

  for (const t of tickets) {
    const { error } = await sb.from("help_desk_tickets").insert(t)
    if (error) console.log(`  ❌ ${t.title}: ${error.message}`)
    else console.log(`  ✅ ${t.title} [${t.status}]`)
  }

  // ── 2. LEAVE REQUEST (Chibuikem requesting leave) ──
  console.log("\n── Leave Requests ──")

  await sb.from("leave_approvals").delete().in("leave_request_id",
    (await sb.from("leave_requests").select("id").eq("user_id", USERS.chibuikem).ilike("reason", "SEED:%")).data?.map((r: any) => r.id) || []
  )
  await sb.from("leave_requests").delete().eq("user_id", USERS.chibuikem).ilike("reason", "SEED:%")

  // First make sure Onyekachukwu is Admin & HR lead for leave to work
  const { data: hrDept } = await sb.from("departments").select("id").eq("name", "Admin & HR").single()
  await sb.from("profiles").update({
    is_department_lead: true,
    lead_departments: ["Admin & HR"],
    department_id: hrDept?.id,
  }).eq("id", USERS.onyekachukwu)

  const { data: leaveReq, error: leaveErr } = await sb.from("leave_requests").insert({
    user_id: USERS.chibuikem,
    leave_type_id: "37ff322d-da8f-4e66-87a1-9a0eb45f7daa", // Annual Leave
    start_date: "2026-04-14",
    end_date: "2026-04-16",
    resume_date: "2026-04-17",
    days_count: 3,
    reason: "SEED: Family event - cousin's wedding in Lagos",
    status: "pending",
    reliever_id: USERS.abdulsamad,
    supervisor_id: USERS.abdulsamad,
    approval_stage: "pending_reliever",
    current_stage_code: "pending_reliever",
    current_stage_order: 1,
    current_approver_user_id: USERS.abdulsamad,
    requester_route_kind: "employee",
    route_snapshot: JSON.stringify([
      { stage_order: 1, approver_role_code: "reliever", approver_user_id: USERS.abdulsamad, stage_code: "pending_reliever" },
      { stage_order: 2, approver_role_code: "department_lead", approver_user_id: USERS.abdulsamad, stage_code: "pending_supervisor" },
      { stage_order: 3, approver_role_code: "admin_hr_lead", approver_user_id: USERS.onyekachukwu, stage_code: "pending_hr" },
    ]),
  }).select("id").single()

  if (leaveErr) console.log(`  ❌ Leave request: ${leaveErr.message}`)
  else console.log(`  ✅ Annual leave request created (pending reliever: Abdulsamad)`)

  // Also create an approved past leave
  const { error: pastLeaveErr } = await sb.from("leave_requests").insert({
    user_id: USERS.chibuikem,
    leave_type_id: "6f303359-e32d-4232-b854-df0e07709a93", // Sick Leave
    start_date: "2026-03-10",
    end_date: "2026-03-11",
    resume_date: "2026-03-12",
    days_count: 2,
    reason: "SEED: Was feeling unwell - fever and headache",
    status: "approved",
    reliever_id: USERS.abdulsamad,
    supervisor_id: USERS.abdulsamad,
    approval_stage: "completed",
    current_stage_code: "completed",
    current_stage_order: 3,
    requester_route_kind: "employee",
  })

  if (pastLeaveErr) console.log(`  ❌ Past sick leave: ${pastLeaveErr.message}`)
  else console.log(`  ✅ Past sick leave (approved, March 10-11)`)

  // ── 3. ADDITIONAL TASKS (for variety of statuses) ──
  console.log("\n── Additional Tasks ──")

  await sb.from("tasks").delete().ilike("title", "SEED:%")

  const tasks = [
    {
      title: "SEED: Update company website contact page",
      description: "Update phone numbers and add new office address",
      assigned_to: USERS.chibuikem,
      assigned_by: USERS.abdulsamad,
      department: "IT and Communications",
      assignment_type: "individual",
      priority: "medium",
      status: "cancelled",
      source_type: "manual",
    },
    {
      title: "SEED: Fix login page CSS on mobile devices",
      description: "Login button overflows on small screens",
      assigned_to: USERS.chibuikem,
      assigned_by: USERS.abdulsamad,
      department: "IT and Communications",
      assignment_type: "individual",
      priority: "high",
      status: "completed",
      source_type: "manual",
    },
    {
      title: "SEED: Review new firewall rules before deployment",
      description: "Security audit of proposed firewall changes",
      assigned_to: USERS.chibuikem,
      assigned_by: USERS.peter,
      department: "IT and Communications",
      assignment_type: "individual",
      priority: "urgent",
      status: "in_progress",
      source_type: "manual",
    },
    {
      title: "SEED: Backup server maintenance - Weekend task",
      description: "Run full backup and verify restore procedure",
      assigned_to: null,
      assigned_by: USERS.abdulsamad,
      department: "IT and Communications",
      assignment_type: "department",
      priority: "high",
      status: "pending",
      source_type: "manual",
    },
  ]

  for (const t of tasks) {
    const { error } = await sb.from("tasks").insert(t)
    if (error) console.log(`  ❌ ${t.title}: ${error.message}`)
    else console.log(`  ✅ ${t.title} [${t.status}] → ${t.assignment_type}`)
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════")
  console.log("SEED COMPLETE - Chibuikem should now see:")
  console.log("  /tasks     → 7+ individual tasks + 52+ dept tasks")
  console.log("  /work      → 7+ work items (individual + multi-assigned)")
  console.log("  /help-desk → 8 tickets (as requester, assignee, or dept)")
  console.log("  /leave     → 2 leave requests (1 pending, 1 approved)")
  console.log("═══════════════════════════════════════════")
}

seed().catch(err => { console.error("Fatal:", err); process.exit(1) })
