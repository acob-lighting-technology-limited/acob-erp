import test from "node:test"
import assert from "node:assert/strict"
import {
  appealReviewBlock,
  canOverrideAppeal,
  employeeAppealStage,
  stagingRoute,
  type AppealReviewer,
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

test("the lead who endorsed an appeal cannot also approve it as admin", () => {
  const appeal = { stage: "pending_admin", initiated_by_role: "employee", lead_reviewed_by: "hr-lead" }
  assert.match(appealReviewBlock(hrLead, appeal, "Admin and HR") ?? "", /another admin/)
  assert.equal(appealReviewBlock(admin, appeal, "Admin and HR"), null)
})

test("any admin approves the admin side, a lead console cannot", () => {
  const appeal = { stage: "pending_admin", initiated_by_role: "lead_on_behalf", created_by: "lead-2" }
  assert.equal(appealReviewBlock(admin, appeal, "Project"), null)
  assert.match(appealReviewBlock(projectLead, appeal, "Project") ?? "", /Only an admin/)
  assert.match(appealReviewBlock({ ...hrLead, scopeMode: "lead" }, appeal, "Project") ?? "", /Only an admin/)
})

test("an admin may approve the admin side of their own appeal", () => {
  const appeal = { stage: "pending_admin", initiated_by_role: "employee", created_by: null, lead_reviewed_by: "x" }
  assert.equal(appealReviewBlock(admin, appeal, "Admin and HR"), null)
})

test("the no-lead stage belongs to the Admin & HR Lead alone", () => {
  const appeal = { stage: "pending_hr_lead", initiated_by_role: "employee", created_by: null }
  assert.equal(appealReviewBlock(hrLead, appeal, "Logistics"), null)
  assert.match(appealReviewBlock(admin, appeal, "Logistics") ?? "", /Admin & HR Lead/)
  assert.match(appealReviewBlock(developer, appeal, "Logistics") ?? "", /Admin & HR Lead/)
})

test("override is for admins on the admin side only", () => {
  assert.equal(canOverrideAppeal(admin), true)
  assert.equal(canOverrideAppeal(developer), true)
  assert.equal(canOverrideAppeal(projectLead), false)
  assert.equal(canOverrideAppeal({ ...hrLead, scopeMode: "lead" }), false)
})

test("staging: an admin's change goes to the lead side, a lead's change to an admin", () => {
  const staff = { department: "Project", department_id: "d", is_department_lead: false, full_name: "Joseph" }
  const lead = { ...staff, is_department_lead: true }
  assert.equal(stagingRoute(admin, staff, true).stage, "pending_lead")
  assert.equal(stagingRoute(admin, lead, true).stage, "pending_lead")
  assert.equal(stagingRoute(admin, staff, false).stage, "pending_hr_lead")
  assert.equal(stagingRoute(projectLead, staff, true).stage, "pending_admin")
  assert.equal(stagingRoute(projectLead, staff, true).initiatedByRole, "lead_on_behalf")
})

test("an employee's own appeal: lead first; a lead goes to an admin; no lead goes to the HR Lead", () => {
  assert.equal(employeeAppealStage({ is_department_lead: false }, true), "pending_lead")
  assert.equal(employeeAppealStage({ is_department_lead: true }, true), "pending_admin")
  assert.equal(employeeAppealStage({ is_department_lead: false }, false), "pending_hr_lead")
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
