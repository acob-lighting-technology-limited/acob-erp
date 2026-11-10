import assert from "node:assert/strict"
import test from "node:test"
import { isBlockedByProbation } from "@/lib/hr/leave-probation"

const unconfirmed = { confirmationDate: null }

test("unconfirmed staff may take only sick leave and leave without pay", () => {
  assert.equal(isBlockedByProbation(unconfirmed, "SICK", "2026-11-10"), false)
  assert.equal(isBlockedByProbation(unconfirmed, "LWOP", "2026-11-10"), false)
  assert.equal(isBlockedByProbation(unconfirmed, "lwop", "2026-11-10"), false)
  assert.equal(isBlockedByProbation(unconfirmed, "ANNUAL", "2026-11-10"), true)
  assert.equal(isBlockedByProbation(unconfirmed, "STUDY", "2026-11-10"), true)
  assert.equal(isBlockedByProbation(unconfirmed, null, "2026-11-10"), true)
})

test("the rule lifts from the confirmation date", () => {
  const confirmed = { confirmationDate: "2026-12-01" }
  assert.equal(isBlockedByProbation(confirmed, "ANNUAL", "2026-11-30"), true)
  assert.equal(isBlockedByProbation(confirmed, "ANNUAL", "2026-12-01"), false)
})
