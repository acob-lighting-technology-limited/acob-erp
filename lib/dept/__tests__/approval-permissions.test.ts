import assert from "node:assert/strict"
import test from "node:test"
import { consolePageKeys } from "../delegated-pages"
import { delegationFields } from "../admin-delegations"

const input = {
  departmentId: "00000000-0000-4000-8000-000000000001",
  delegateId: "00000000-0000-4000-8000-000000000002",
  validUntil: "2026-12-01T10:00:00+01:00",
}

test("approval permissions require their matching page and do not grant additional page access", () => {
  assert.equal(delegationFields.safeParse({ ...input, pages: ["tasks", "approve:tasks"] }).success, true)
  assert.equal(delegationFields.safeParse({ ...input, pages: ["tasks", "approve:hr.leave"] }).success, false)
  assert.deepEqual(consolePageKeys(["tasks", "approve:tasks"]), ["tasks"])
})

test("requisition signing is outside department-lead approval delegation", () => {
  assert.equal(
    delegationFields.safeParse({
      ...input,
      pages: ["accounts.requisitions", "approve:accounts.requisitions"],
    }).success,
    false
  )
})
