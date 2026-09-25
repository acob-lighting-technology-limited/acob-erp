import { strict as assert } from "node:assert"
import { test } from "node:test"
import { isLeadForTaskDepartment, isSelfRatingBlocked } from "../rating-authority"

test("a regular employee cannot rate their own task", () => {
  assert.equal(isSelfRatingBlocked({ userId: "staff", assigneeIds: ["staff"], isLeadOrAdmin: false }), true)
})

test("a department lead or admin is permitted to rate their own task", () => {
  assert.equal(isSelfRatingBlocked({ userId: "lead", assigneeIds: ["lead"], isLeadOrAdmin: true }), false)
})

test("a group-task member who is not a lead cannot rate the task either", () => {
  assert.equal(isSelfRatingBlocked({ userId: "staff", assigneeIds: [null, "someone", "staff"] }), true)
})

test("a reviewer who is not an assignee may rate", () => {
  assert.equal(isSelfRatingBlocked({ userId: "lead", assigneeIds: ["staff"] }), false)
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
