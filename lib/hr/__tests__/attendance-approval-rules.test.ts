import test from "node:test"
import assert from "node:assert/strict"
import {
  appealReviewBlock,
  EMPTY_APPEAL_ROUTING,
  appealStuckReason,
  employeeAppealStage,
  leadFirstBlock,
  overrideBlock,
  stagingRoute,
  workingDaysSince,
  type AppealReviewer,
  type AppealRoutingContext,
} from "@/lib/hr/attendance-appeals"
import { appealAuditSteps } from "@/lib/hr/appeal-audit"

const admin: AppealReviewer = {
  userId: "admin-1",
  department: "Admin and HR",
  isDepartmentLead: false,
  leadDepartments: [],
  isAdminLike: true,
  scopeMode: "global",
}
const developer: AppealReviewer = { ...admin, userId: "dev-1", department: "IT and Communications" }
const projectLead: AppealReviewer = {
  userId: "lead-1",
  department: "Project",
  isDepartmentLead: true,
  leadDepartments: ["Project"],
  isAdminLike: false,
  scopeMode: "lead",
}
const hrLead: AppealReviewer = {
  userId: "hr-lead",
  department: "Admin and HR",
  isDepartmentLead: true,
  leadDepartments: ["Admin and HR"],
  isAdminLike: true,
  scopeMode: "global",
}

test("only the employee's real lead can do the lead step, never an admin or developer", () => {
  const appeal = { stage: "pending_lead", initiated_by_role: "admin_manual", created_by: "rafiat" }
  assert.equal(appealReviewBlock(projectLead, appeal, "Project"), null)
  assert.match(appealReviewBlock(developer, appeal, "Project") ?? "", /Department Lead for Project/)
  assert.match(appealReviewBlock(admin, appeal, "Project") ?? "", /Department Lead for Project/)
  assert.match(appealReviewBlock(hrLead, appeal, "Project") ?? "", /Department Lead for Project/)
})

test("an employee appeal's lead step is also only the real lead", () => {
  const appeal = { stage: "pending_lead", initiated_by_role: "employee", created_by: null }
  assert.match(appealReviewBlock(admin, appeal, "Project") ?? "", /Department Lead/)
  assert.equal(appealReviewBlock(projectLead, appeal, "Project"), null)
})

test("whoever made a change cannot confirm it", () => {
  const appeal = { stage: "pending_lead", initiated_by_role: "admin_manual", created_by: "hr-lead" }
  assert.match(appealReviewBlock(hrLead, appeal, "Admin and HR") ?? "", /You made this change/)
})

// Onyeka-style Admin & HR Lead, her delegate, and an unrelated admin.
const routing: AppealRoutingContext = {
  adminHrLeadIds: ["hr-lead"],
  leadIdsByDepartment: { "Admin and HR": ["hr-lead"], Project: ["lead-1"] },
  onLeaveIds: [],
  leadsWithDelegate: ["hr-lead"],
  actingForLeadIds: [],
}
const asDelegate: AppealRoutingContext = { ...routing, actingForLeadIds: ["hr-lead"] }
const delegate: AppealReviewer = { ...admin, userId: "rafiat" }
const NOW = new Date("2026-11-09T09:00:00Z") // a Monday

test("the lead who endorsed an appeal cannot also decide the second stage", () => {
  const appeal = { stage: "pending_admin", initiated_by_role: "employee", lead_reviewed_by: "hr-lead" }
  assert.match(appealReviewBlock(hrLead, appeal, "Admin and HR", routing) ?? "", /someone else must approve/)
})

test("the second stage is the Admin & HR Lead's and their delegate's, never any admin's", () => {
  const appeal = { stage: "pending_admin", initiated_by_role: "lead_on_behalf", created_by: "lead-2", user_id: "staff" }
  assert.equal(appealReviewBlock(hrLead, appeal, "Project", routing), null)
  assert.equal(appealReviewBlock(delegate, appeal, "Project", asDelegate), null)
  // An admin, a super admin, a developer and another lead are all refused.
  assert.match(appealReviewBlock(admin, appeal, "Project", routing) ?? "", /Admin & HR Lead/)
  assert.match(appealReviewBlock(developer, appeal, "Project", routing) ?? "", /Admin & HR Lead/)
  assert.match(appealReviewBlock(projectLead, appeal, "Project", routing) ?? "", /Admin & HR Lead/)
})

test("the no-lead stage and Admin & HR's own staff follow the same person rule", () => {
  const appeal = { stage: "pending_hr_lead", initiated_by_role: "employee", created_by: null, user_id: "staff" }
  assert.equal(appealReviewBlock(hrLead, appeal, "Logistics", routing), null)
  assert.equal(appealReviewBlock(delegate, appeal, "Logistics", asDelegate), null)
  assert.match(appealReviewBlock(admin, appeal, "Logistics", routing) ?? "", /Admin & HR Lead/)
})

test("the Admin & HR Lead decides her own appeal; her delegate cannot", () => {
  const own = { stage: "pending_hr_lead", initiated_by_role: "employee", created_by: null, user_id: "hr-lead" }
  assert.equal(appealReviewBlock(hrLead, own, "Admin and HR", routing), null)
  assert.match(appealReviewBlock(delegate, own, "Admin and HR", asDelegate) ?? "", /their own appeal/)
})

test("a delegate decides their own appeal only while the Admin & HR Lead is on leave", () => {
  const own = { stage: "pending_hr_lead", initiated_by_role: "employee", created_by: null, user_id: "rafiat" }
  assert.match(appealReviewBlock(delegate, own, "Admin and HR", asDelegate) ?? "", /available/)
  assert.equal(appealReviewBlock(delegate, own, "Admin and HR", { ...asDelegate, onLeaveIds: ["hr-lead"] }), null)
  // The Admin & HR Lead can still decide it.
  assert.equal(appealReviewBlock(hrLead, own, "Admin and HR", routing), null)
})

test("working days skip weekends and count up to today", () => {
  assert.equal(workingDaysSince("2026-11-09T08:00:00Z", NOW), 0) // same day
  assert.equal(workingDaysSince("2026-11-09T08:00:00Z", new Date("2026-11-13T09:00:00Z")), 4) // Mon -> Fri
  assert.equal(workingDaysSince("2026-11-09T08:00:00Z", new Date("2026-11-16T09:00:00Z")), 5) // Mon -> next Mon
})

test("stuck: five working days with no decision, or the approver on leave with no delegate", () => {
  const appeal = { stage: "pending_lead", created_at: "2026-11-02T08:00:00Z" }
  assert.match(appealStuckReason(appeal, "Project", routing, NOW) ?? "", /5\+ working days/)
  const fresh = { stage: "pending_lead", created_at: "2026-11-06T08:00:00Z" }
  assert.equal(appealStuckReason(fresh, "Project", routing, NOW), null)
  // A lead on leave holds it up straight away.
  const away: AppealRoutingContext = { ...routing, onLeaveIds: ["lead-1"] }
  assert.match(appealStuckReason(fresh, "Project", away, NOW) ?? "", /on leave/)
  // The Admin & HR Lead on leave with a delegate is not stuck.
  const second = {
    stage: "pending_admin",
    lead_reviewed_at: "2026-11-09T07:00:00Z",
    created_at: "2026-11-02T08:00:00Z",
  }
  assert.equal(appealStuckReason(second, "Project", { ...routing, onLeaveIds: ["hr-lead"] }, NOW), null)
  assert.match(
    appealStuckReason(second, "Project", { ...routing, onLeaveIds: ["hr-lead"], leadsWithDelegate: [] }, NOW) ?? "",
    /on leave/
  )
})

test("override: super admin or developer only, and only once the approval is stuck", () => {
  const stuck = { stage: "pending_lead", created_at: "2026-11-02T08:00:00Z" }
  const fresh = { stage: "pending_lead", created_at: "2026-11-09T07:00:00Z" }
  const superAdmin = { role: "super_admin", isAdminLike: true, scopeMode: "global" as const }
  const dev = { role: "developer", isAdminLike: true, scopeMode: "global" as const }
  const plainAdmin = { role: "admin", isAdminLike: true, scopeMode: "global" as const }
  assert.equal(overrideBlock(superAdmin, stuck, "Project", routing, NOW), null)
  assert.equal(overrideBlock(dev, stuck, "Project", routing, NOW), null)
  assert.match(overrideBlock(plainAdmin, stuck, "Project", routing, NOW) ?? "", /super admin or developer/)
  assert.match(overrideBlock(superAdmin, fresh, "Project", routing, NOW) ?? "", /stuck/)
  assert.match(overrideBlock({ ...superAdmin, scopeMode: "lead" }, stuck, "Project", routing, NOW) ?? "", /super admin/)
})

test("staging: an admin's manual change goes to the lead side, a lead's change to the second stage", () => {
  const staff = { department: "Project", department_id: "d", is_department_lead: false, full_name: "Joseph" }
  const lead = { ...staff, is_department_lead: true }
  assert.equal(stagingRoute(admin, staff, true).stage, "pending_lead")
  assert.equal(stagingRoute(admin, lead, true).stage, "pending_lead")
  assert.equal(stagingRoute(admin, staff, false).stage, "pending_hr_lead")
  assert.equal(stagingRoute(projectLead, staff, true).stage, "pending_admin")
  assert.equal(stagingRoute(projectLead, staff, true).initiatedByRole, "lead_on_behalf")
})

test("a single-day change never starts from the admin side", () => {
  assert.match(leadFirstBlock(admin) ?? "", /department lead/)
  assert.match(leadFirstBlock(developer) ?? "", /department lead/)
  assert.equal(leadFirstBlock(projectLead), null)
  assert.equal(leadFirstBlock({ ...hrLead, scopeMode: "lead" }), null)
})

test("an employee's own appeal: lead first; a lead goes to the Admin & HR Lead; no lead goes to the HR Lead", () => {
  assert.equal(employeeAppealStage({ is_department_lead: false, department: "Project" }, true), "pending_lead")
  assert.equal(employeeAppealStage({ is_department_lead: true, department: "Project" }, true), "pending_admin")
  assert.equal(employeeAppealStage({ is_department_lead: false, department: "Logistics" }, false), "pending_hr_lead")
})

test("Admin & HR's own staff, and the Admin & HR Lead, have one stage", () => {
  assert.equal(employeeAppealStage({ is_department_lead: false, department: "Admin and HR" }, true), "pending_hr_lead")
  assert.equal(employeeAppealStage({ is_department_lead: true, department: "Admin and HR" }, true), "pending_hr_lead")
})

test("with no routing context loaded nobody passes the second stage", () => {
  const appeal = { stage: "pending_admin", initiated_by_role: "employee", user_id: "staff" }
  assert.match(appealReviewBlock(hrLead, appeal, "Project", EMPTY_APPEAL_ROUTING) ?? "", /Admin & HR Lead/)
})

test("audit: an admin's change shows as made, not approved, and the lead confirmation is the outcome", () => {
  const steps = appealAuditSteps({
    status: "approved",
    stage: "approved",
    initiated_by_role: "admin_manual",
    created_by_name: "Rafiat Egunjobi",
    created_at: "2026-10-28T07:17:00Z",
    admin_reviewer_name: "Rafiat Egunjobi",
    admin_reviewed_at: "2026-10-28T07:17:00Z",
    admin_resolution_note: "Field",
    lead_reviewed_by: "lead-1",
    lead_reviewer_name: "Project Lead",
    lead_reviewed_at: "2026-10-29T20:39:00Z",
    reviewed_by: "lead-1",
    reviewer_name: "Project Lead",
    reviewed_at: "2026-10-29T20:39:00Z",
  })
  const admin = steps.find((s) => s.key === "admin")!
  assert.equal(admin.text, "Made the change")
  assert.equal(steps.find((s) => s.key === "lead")!.text, "Confirmed")
  assert.deepEqual({ text: steps.at(-1)!.text, by: steps.at(-1)!.by }, { text: "Approved", by: "Project Lead" })
})

test("audit: an override names who overrode, the reason, and the skipped step", () => {
  const steps = appealAuditSteps({
    status: "approved",
    stage: "approved",
    initiated_by_role: "admin_manual",
    created_by_name: "Rafiat Egunjobi",
    created_at: "2026-10-28T07:17:00Z",
    overridden_by_name: "Chibuikem Ilonze",
    overridden_at: "2026-10-30T09:00:00Z",
    override_reason: "Lead on leave",
    overridden_stage: "pending_lead",
  })
  assert.equal(steps.find((s) => s.key === "lead")!.state, "skipped")
  const outcome = steps.at(-1)!
  assert.equal(outcome.state, "override")
  assert.equal(outcome.by, "Chibuikem Ilonze")
  assert.equal(outcome.note, "Lead on leave")
})
