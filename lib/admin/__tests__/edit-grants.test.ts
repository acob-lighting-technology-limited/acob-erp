import assert from "node:assert/strict"
import test from "node:test"
import { buildAccessContextV2, type AdminRouteKeyV2 } from "@/lib/admin/policy-v2"
import { canRevokeEditGrant, checkEditGrantRequest, type EditGrantRequest } from "@/lib/admin/edit-grants"

const NOW = new Date("2026-11-09T09:00:00Z")
const IN_30_DAYS = new Date("2026-12-09T09:00:00Z")

function lead(dept: string) {
  return buildAccessContextV2({
    role: "super_admin",
    isDepartmentLead: true,
    isAdminLike: true,
    adminRoutes: null,
    scopeMode: "global",
    managedDepartments: [],
    leadDepartments: [dept],
  })
}

function request(overrides: Partial<EditGrantRequest> = {}): EditGrantRequest {
  return {
    mode: "delegate",
    actorId: "lead-1",
    actorRole: "super_admin",
    actorContext: lead("Admin and HR"),
    actorOwnGrantRoutes: [],
    targetId: "rafiat",
    targetRole: "admin",
    targetAdminRoutes: ["hr.main", "hr.attendance"] as AdminRouteKeyV2[],
    routes: ["hr.attendance"] as AdminRouteKeyV2[],
    validUntil: IN_30_DAYS,
    now: NOW,
    ...overrides,
  }
}

test("the owning lead can delegate their area to an admin who can already view it", () => {
  assert.equal(checkEditGrantRequest(request()), null)
})

test("nobody grants or delegates to themselves", () => {
  assert.match(checkEditGrantRequest(request({ targetId: "lead-1" })) ?? "", /yourself/)
})

test("the target must hold the admin role", () => {
  assert.match(checkEditGrantRequest(request({ targetRole: "employee" })) ?? "", /admin role/)
})

test("a delegation needs an end date and cannot exceed a year", () => {
  assert.match(checkEditGrantRequest(request({ validUntil: null })) ?? "", /end date/)
  const far = new Date("2028-01-01T00:00:00Z")
  assert.match(checkEditGrantRequest(request({ validUntil: far })) ?? "", /at most/)
})

test("the end date must be in the future", () => {
  assert.match(checkEditGrantRequest(request({ validUntil: new Date("2026-11-01T00:00:00Z") })) ?? "", /future/)
})

test("a lead cannot delegate an area they do not own", () => {
  const msg = checkEditGrantRequest(request({ actorContext: lead("Accounts"), routes: ["hr.attendance"] }))
  assert.match(msg ?? "", /hold yourself/)
})

test("a delegate cannot pass access along: only owners and explicit grant holders delegate", () => {
  const delegate = buildAccessContextV2({
    role: "admin",
    isDepartmentLead: false,
    isAdminLike: true,
    adminRoutes: ["hr.main"],
    scopeMode: "global",
    managedDepartments: [],
    editRoutes: ["hr.attendance"], // held by delegation only
  })
  const msg = checkEditGrantRequest(request({ actorContext: delegate, actorOwnGrantRoutes: [] }))
  assert.match(msg ?? "", /pass it on/)
})

test("a holder of an explicit grant may delegate that route", () => {
  const holder = buildAccessContextV2({
    role: "admin",
    isDepartmentLead: false,
    isAdminLike: true,
    adminRoutes: ["hr.main"],
    scopeMode: "global",
    managedDepartments: [],
    editRoutes: ["hr.attendance"],
  })
  assert.equal(checkEditGrantRequest(request({ actorContext: holder, actorOwnGrantRoutes: ["hr.attendance"] })), null)
})

test("only a developer or super admin grants outright, and a grant may have no end date", () => {
  const dev = request({ mode: "grant", actorRole: "developer", validUntil: null })
  assert.equal(checkEditGrantRequest(dev), null)
  const admin = request({ mode: "grant", actorRole: "admin" })
  assert.match(checkEditGrantRequest(admin) ?? "", /developer or super admin/)
})

test("edit never exceeds view", () => {
  const msg = checkEditGrantRequest(request({ targetAdminRoutes: [] }))
  assert.match(msg ?? "", /view access/)
})

test("routes without an edit level cannot be granted", () => {
  const msg = checkEditGrantRequest(request({ routes: ["accounts.main"] as AdminRouteKeyV2[] }))
  assert.match(msg ?? "", /no edit level/)
})

test("revoking: the granter, the delegator, or a developer / super admin", () => {
  const row = { granted_by: "lead-1", delegated_from: "lead-1" }
  assert.equal(canRevokeEditGrant({ actorId: "lead-1", actorRole: "admin", row }), true)
  assert.equal(canRevokeEditGrant({ actorId: "other", actorRole: "admin", row }), false)
  assert.equal(canRevokeEditGrant({ actorId: "other", actorRole: "developer", row }), true)
  assert.equal(canRevokeEditGrant({ actorId: "other", actorRole: "super_admin", row }), true)
})
