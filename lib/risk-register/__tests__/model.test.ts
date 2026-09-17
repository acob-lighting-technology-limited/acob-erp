import { strict as assert } from "node:assert"
import { test } from "node:test"
import { CreateRiskSchema, UpdateRiskSchema, isRiskOverdue, ratingForScore, riskReference } from "../model"

const VALID = {
  department: "Business Growth and Innovation",
  risk_name: "Workforce gap",
  description: "Insufficient personnel to manage the volume of bids",
  impact: 4,
  likelihood: 3,
  control_owner_departments: ["Admin & HR"],
  timeline_type: "by_date" as const,
  target_date: "2026-10-17",
}

test("rating bands follow the template's colour scale", () => {
  assert.equal(ratingForScore(1), "green")
  assert.equal(ratingForScore(4), "green")
  assert.equal(ratingForScore(5), "yellow")
  // 4 x 3 was marked Yellow on the BGI sample sheet.
  assert.equal(ratingForScore(12), "yellow")
  assert.equal(ratingForScore(15), "red")
  assert.equal(ratingForScore(25), "red")
})

test("reference pads the per-department serial number", () => {
  assert.equal(riskReference("BGI", "Business Growth and Innovation", 3), "BGI-03")
  assert.equal(riskReference(null, "Admin & HR", 12), "Admin & HR-12")
})

test("only dated, unfinished mitigations can be overdue", () => {
  const today = "2026-09-17"
  assert.equal(isRiskOverdue({ status: "open", timeline_type: "by_date", target_date: "2026-09-16" }, today), true)
  assert.equal(isRiskOverdue({ status: "open", timeline_type: "by_date", target_date: today }, today), false)
  assert.equal(isRiskOverdue({ status: "closed", timeline_type: "by_date", target_date: "2026-01-01" }, today), false)
  assert.equal(isRiskOverdue({ status: "in_progress", timeline_type: "continuous", target_date: null }, today), false)
})

test("a dated timeline needs its date; a continuous one drops it", () => {
  assert.equal(CreateRiskSchema.safeParse({ ...VALID, target_date: null }).success, false)

  const continuous = CreateRiskSchema.parse({ ...VALID, timeline_type: "continuous" })
  assert.equal(continuous.target_date, null)
})

test("a risk needs at least one control owner and blank text becomes null", () => {
  assert.equal(CreateRiskSchema.safeParse({ ...VALID, control_owner_departments: [] }).success, false)

  const parsed = CreateRiskSchema.parse({ ...VALID, causes: "   ", mitigation_plan: "" })
  assert.equal(parsed.causes, null)
  assert.equal(parsed.mitigation_plan, null)
  assert.equal(parsed.status, "open")
})

test("scores outside 1-5 are rejected", () => {
  assert.equal(CreateRiskSchema.safeParse({ ...VALID, impact: 6 }).success, false)
  assert.equal(CreateRiskSchema.safeParse({ ...VALID, likelihood: 0 }).success, false)
})

test("a status-only update does not demand a timeline", () => {
  assert.equal(UpdateRiskSchema.safeParse({ status: "in_progress" }).success, true)
  assert.equal(UpdateRiskSchema.safeParse({ timeline_type: "by_date" }).success, false)
})

test("a partial update carries only the fields sent, so owner edits are not widened by defaults", () => {
  assert.deepEqual(UpdateRiskSchema.parse({ status: "closed" }), { status: "closed" })
})
