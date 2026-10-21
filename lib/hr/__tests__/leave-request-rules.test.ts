import { test } from "node:test"
import assert from "node:assert/strict"
import { leaveRequestMissing, type LeaveRequestRuleInput } from "../leave-request-rules"

const complete: LeaveRequestRuleInput = {
  leave_type_id: "annual",
  segments: [{ start: "2026-11-02", end: "2026-11-04" }],
  reason: "Family",
  reliever_identifier: "emp-2",
  handover_file: { name: "handover.pdf" },
  handover_checklist_url: null,
  attachment: null,
}
const context = { totalDays: 3, availableDays: 10, requiresAttachment: false }

test("a complete request has nothing missing", () => {
  assert.deepEqual(leaveRequestMissing(complete, context), [])
})

test("missing items are listed in form order", () => {
  const empty: LeaveRequestRuleInput = {
    ...complete,
    leave_type_id: "",
    segments: [],
    reason: "",
    reliever_identifier: "",
    handover_file: null,
    handover_checklist_url: null,
  }
  assert.deepEqual(leaveRequestMissing(empty, { ...context, totalDays: 0 }), [
    "Choose a leave type",
    "Pick your leave dates",
    "Give a reason",
    "Choose a reliever",
    "Attach your handover document",
  ])
})

test("a request longer than the balance says how many days are left", () => {
  assert.deepEqual(leaveRequestMissing(complete, { ...context, totalDays: 5, availableDays: 2 }), [
    "This request is 5 days; you have 2 available",
  ])
})

test("one day is singular", () => {
  assert.deepEqual(leaveRequestMissing(complete, { ...context, totalDays: 1, availableDays: 0 }), [
    "This request is 1 day; you have 0 available",
  ])
})

test("dates with no working day are reported", () => {
  assert.deepEqual(leaveRequestMissing(complete, { ...context, totalDays: 0 }), ["Pick at least one working day"])
})

test("a required attachment is reported when missing", () => {
  assert.deepEqual(leaveRequestMissing(complete, { ...context, requiresAttachment: true }), [
    "Attach the document this leave type requires",
  ])
})

test("a checklist link counts as the handover document", () => {
  const withLink: LeaveRequestRuleInput = { ...complete, handover_file: null, handover_checklist_url: "https://x" }
  assert.deepEqual(leaveRequestMissing(withLink, context), [])
})
