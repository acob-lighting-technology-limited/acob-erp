import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveRequisitionStages, type RoutingProfile } from "../routing"
import { amountChangeMessage, amountOutOfRangeMessage, lineItemsTotal } from "../limits"

const lead = (id: string, department: string, extra: string[] = []): RoutingProfile => ({
  id,
  department,
  is_department_lead: true,
  lead_departments: [department, ...extra],
})
const staff = (id: string, department: string): RoutingProfile => ({
  id,
  department,
  is_department_lead: false,
  lead_departments: [],
})

// Mirrors production leads as of 2026-10-13.
const LEADS = [
  lead("accounts", "Accounts"),
  lead("hr", "Admin and HR"),
  lead("hcs", "Corporate Services", ["IT and Communications"]),
  lead("md", "Executive Management"),
  lead("project", "Project"),
  lead("technical", "Technical"),
  lead("om", "Operations and Maintenance"),
  lead("qa", "Quality Assurance"),
]

function route(formType: "payment_request" | "petty_cash", requester: RoutingProfile) {
  return resolveRequisitionStages(formType, requester, [...LEADS, requester]).map((s) =>
    s.state === "not_required" ? `${s.stage_code}:—` : `${s.stage_code}:${s.assignee_id}`
  )
}

test("payment request: Project/Technical/O&M skip review and go to their lead", () => {
  assert.deepEqual(route("payment_request", staff("u", "Technical")), [
    "reviewed:—",
    "authorized:technical",
    "verified:accounts",
    "approved:md",
  ])
  assert.deepEqual(route("payment_request", staff("u", "Operations and Maintenance"))[1], "authorized:om")
})

test("payment request: every other department goes HR Lead → HCS", () => {
  for (const dept of ["IT and Communications", "Quality Assurance", "Logistics", "SIWES", "Accounts"]) {
    assert.deepEqual(route("payment_request", staff("u", dept)), [
      "reviewed:hr",
      "authorized:hcs",
      "verified:accounts",
      "approved:md",
    ])
  }
})

test("payment request: a lead-authorized department lead is authorized by HCS", () => {
  assert.deepEqual(route("payment_request", lead("technical", "Technical")), [
    "reviewed:—",
    "authorized:hcs",
    "verified:accounts",
    "approved:md",
  ])
})

test("payment request: HR Lead skips review, HCS is authorized by the MD, MD skips approval", () => {
  assert.deepEqual(route("payment_request", lead("hr", "Admin and HR")), [
    "reviewed:—",
    "authorized:hcs",
    "verified:accounts",
    "approved:md",
  ])
  assert.deepEqual(route("payment_request", lead("hcs", "Corporate Services", ["IT and Communications"])), [
    "reviewed:hr",
    "authorized:md",
    "verified:accounts",
    "approved:md",
  ])
  assert.deepEqual(route("payment_request", lead("md", "Executive Management")), [
    "reviewed:hr",
    "authorized:hcs",
    "verified:accounts",
    "approved:—",
  ])
})

test("payment request: the Accounts Lead's own verify stage stays, for the MD to bypass", () => {
  const stages = resolveRequisitionStages("payment_request", lead("accounts", "Accounts"), LEADS)
  assert.equal(stages[2].assignee_id, "accounts")
  assert.equal(stages[2].state, "pending")
  assert.match(stages[2].state_note || "", /bypasses/)
})

test("petty cash: HR Lead authorizes, own lead approves", () => {
  assert.deepEqual(route("petty_cash", staff("u", "Technical")), ["authorized:hr", "approved:technical"])
  assert.deepEqual(route("petty_cash", staff("u", "IT and Communications")), ["authorized:hr", "approved:hcs"])
})

test("petty cash: self-signing moves up a level", () => {
  // A department lead → HCS approves.
  assert.deepEqual(route("petty_cash", lead("qa", "Quality Assurance")), ["authorized:hr", "approved:hcs"])
  // Admin & HR staff → HCS approves (HR Lead would sign twice).
  assert.deepEqual(route("petty_cash", staff("u", "Admin and HR")), ["authorized:hr", "approved:hcs"])
  // HR Lead → HCS authorizes; approval would also be HCS, so the MD approves.
  assert.deepEqual(route("petty_cash", lead("hr", "Admin and HR")), ["authorized:hcs", "approved:md"])
  // HCS → MD approves.
  assert.deepEqual(route("petty_cash", lead("hcs", "Corporate Services", ["IT and Communications"])), [
    "authorized:hr",
    "approved:md",
  ])
  // MD → their lead is themselves, so HCS approves.
  assert.deepEqual(route("petty_cash", lead("md", "Executive Management")), ["authorized:hr", "approved:hcs"])
})

test("petty cash: a department with no lead goes to HCS", () => {
  assert.deepEqual(route("petty_cash", staff("u", "Logistics")), ["authorized:hr", "approved:hcs"])
})

test("nobody is ever routed their own pending stage except the Accounts Lead's verify", () => {
  const requesters = [...LEADS, staff("s1", "Technical"), staff("s2", "Admin and HR"), staff("s3", "Logistics")]
  for (const formType of ["payment_request", "petty_cash"] as const) {
    for (const requester of requesters) {
      for (const stage of resolveRequisitionStages(formType, requester, LEADS)) {
        if (stage.state !== "pending" || stage.assignee_id !== requester.id) continue
        assert.equal(`${formType}:${requester.id}:${stage.stage_code}`, "payment_request:accounts:verified")
      }
    }
  }
})

test("department names are normalised", () => {
  assert.deepEqual(route("payment_request", staff("u", "O&M"))[1], "authorized:om")
})

test("amount limits", () => {
  assert.equal(amountOutOfRangeMessage("payment_request", 30_000), null)
  assert.match(amountOutOfRangeMessage("payment_request", 29_999) || "", /Petty Cash/)
  assert.equal(amountOutOfRangeMessage("petty_cash", 50_000), null)
  assert.match(amountOutOfRangeMessage("petty_cash", 50_001) || "", /Payment Request/)
  assert.equal(amountOutOfRangeMessage("petty_cash", 100), null)
})

test("amount changes", () => {
  assert.match(amountChangeMessage("petty_cash", 40_000, 60_000) || "", /cannot go above/)
  assert.equal(amountChangeMessage("payment_request", 40_000, 20_000), null)
  assert.match(amountChangeMessage("payment_request", 40_000, 40_000) || "", /same/)
  assert.match(amountChangeMessage("payment_request", 40_000, 0) || "", /greater than zero/)
})

test("line item totals round to kobo", () => {
  assert.equal(lineItemsTotal([{ amount: 0.1 }, { amount: 0.2 }, { amount: "1000" }]), 1000.3)
})
