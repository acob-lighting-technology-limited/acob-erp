import test from "node:test"
import assert from "node:assert/strict"
import { LEAVE_COVERS_ATTENDANCE_OR, MD_PENDING_STAGE, isLeavePendingMd } from "@/lib/hr/leave-attendance-filter"

test("pending leave whose remaining stage is the MD is flagged", () => {
  assert.equal(isLeavePendingMd({ status: "pending", current_stage_code: MD_PENDING_STAGE }), true)
})

test("approved leave is not flagged pending", () => {
  assert.equal(isLeavePendingMd({ status: "approved", current_stage_code: MD_PENDING_STAGE }), false)
  assert.equal(isLeavePendingMd({ status: "approved", current_stage_code: null }), false)
})

test("leave still held by an earlier approver is not flagged", () => {
  assert.equal(isLeavePendingMd({ status: "pending", current_stage_code: "pending_department_lead" }), false)
  assert.equal(isLeavePendingMd({ status: "pending", current_stage_code: "pending_admin_hr_lead" }), false)
  assert.equal(isLeavePendingMd({ status: "pending", current_stage_code: null }), false)
})

test("rejected or cancelled leave stops counting, so its days revert", () => {
  assert.equal(isLeavePendingMd({ status: "rejected", current_stage_code: MD_PENDING_STAGE }), false)
  assert.equal(isLeavePendingMd({ status: "cancelled", current_stage_code: MD_PENDING_STAGE }), false)
})

test("the filter covers approved and MD-stage pending only", () => {
  assert.equal(LEAVE_COVERS_ATTENDANCE_OR, "status.eq.approved,and(status.eq.pending,current_stage_code.eq.pending_md)")
})
