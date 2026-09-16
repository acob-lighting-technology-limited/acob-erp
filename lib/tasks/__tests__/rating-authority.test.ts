import { strict as assert } from "node:assert"
import { test } from "node:test"
import { isLeadForTaskDepartment, isSelfRatingBlocked } from "../rating-authority"

test("an assignee cannot rate their own task", () => {
  assert.equal(isSelfRatingBlocked({ userId: "lead", assigneeIds: ["lead"] }), true)
})

test("a group-task member cannot rate the task either", () => {
  assert.equal(isSelfRatingBlocked({ userId: "lead", assigneeIds: [null, "someone", "lead"] }), true)
})

test("a reviewer who is not an assignee may rate", () => {
  assert.equal(isSelfRatingBlocked({ userId: "lead", assigneeIds: ["staff"] }), false)
})

test("the MD is not exempt: nobody rates their own task", () => {
  // The MD used to be able to self-rate, as the one person above every lead.
  // Review is an admin-side job now, so another administrator does it.
  assert.equal(isSelfRatingBlocked({ userId: "md", assigneeIds: ["md"] }), true)
})

test("a missing user id never matches an unassigned task", () => {
  assert.equal(isSelfRatingBlocked({ userId: null, assigneeIds: [null] }), false)
})

test("lead scope covers the home department and extra lead departments", () => {
  const lead = { is_department_lead: true, department: "IT", lead_departments: ["Operations"] }
  assert.equal(isLeadForTaskDepartment(lead, "IT"), true)
  assert.equal(isLeadForTaskDepartment(lead, "Operations"), true)
  assert.equal(isLeadForTaskDepartment(lead, "Finance"), false)
  assert.equal(isLeadForTaskDepartment({ ...lead, is_department_lead: false }, "IT"), false)
})
