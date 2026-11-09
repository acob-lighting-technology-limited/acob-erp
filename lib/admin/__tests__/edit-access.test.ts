import assert from "node:assert/strict"
import test from "node:test"
import {
  buildAccessContextV2,
  canAccessRouteV2,
  canEditRouteV2,
  resolveAdminRouteKeyV2,
  resolveApiEditRouteKeyV2,
  type AccessScopeInputV2,
} from "@/lib/admin/policy-v2"

function ctx(overrides: Partial<AccessScopeInputV2>) {
  return buildAccessContextV2({
    role: "admin",
    isDepartmentLead: false,
    isAdminLike: true,
    adminRoutes: [],
    scopeMode: "global",
    managedDepartments: [],
    ...overrides,
  })
}

test("a plain admin with the HR route can view HR but not edit it", () => {
  const c = ctx({ adminRoutes: ["hr.main", "hr.attendance"] })
  assert.equal(canAccessRouteV2(c, "hr.attendance"), true)
  assert.equal(canEditRouteV2(c, "hr.attendance"), false)
})

test("the Admin and HR lead edits HR without any grant", () => {
  const c = ctx({
    role: "super_admin",
    isDepartmentLead: true,
    adminRoutes: null,
    department: "Admin and HR",
    leadDepartments: ["Admin and HR"],
  })
  assert.equal(canEditRouteV2(c, "hr.attendance"), true)
  assert.equal(canEditRouteV2(c, "hr.leave"), true)
})

test("the Corporate Services lead edits HR; the IT lead does not", () => {
  const hcs = ctx({
    role: "super_admin",
    isDepartmentLead: true,
    adminRoutes: null,
    leadDepartments: ["Corporate Services"],
  })
  const itc = ctx({
    role: "super_admin",
    isDepartmentLead: true,
    adminRoutes: null,
    leadDepartments: ["IT and Communications"],
  })
  assert.equal(canEditRouteV2(hcs, "hr.main"), true)
  assert.equal(canEditRouteV2(itc, "hr.main"), false)
  assert.equal(canEditRouteV2(itc, "it.main"), true)
  assert.equal(canEditRouteV2(hcs, "it.main"), false)
})

test("a lead with no lead_departments falls back to their own department", () => {
  const c = ctx({ role: "super_admin", isDepartmentLead: true, adminRoutes: null, department: "IT and Communications" })
  assert.equal(canEditRouteV2(c, "it.main"), true)
})

test("a department lead who is not a lead of the owning department gets no edit", () => {
  const c = ctx({ role: "super_admin", isDepartmentLead: true, adminRoutes: null, leadDepartments: ["Accounts"] })
  assert.equal(canEditRouteV2(c, "hr.main"), false)
  assert.equal(canEditRouteV2(c, "it.main"), false)
})

test("developer and super admin view every route but do not edit HR or IT automatically", () => {
  for (const role of ["developer", "super_admin"]) {
    const c = ctx({ role, adminRoutes: null })
    assert.equal(canAccessRouteV2(c, "it.main"), true)
    assert.equal(canEditRouteV2(c, "it.main"), false)
    assert.equal(canEditRouteV2(c, "hr.attendance"), false)
  }
})

test("an explicit grant gives edit on that route only", () => {
  const c = ctx({ role: "developer", adminRoutes: null, editRoutes: ["it.main"] })
  assert.equal(canEditRouteV2(c, "it.main"), true)
  assert.equal(canEditRouteV2(c, "security.networkActivity"), true) // it.main covers the IT group
  assert.equal(canEditRouteV2(c, "hr.attendance"), false)
})

test("a grant on one HR route does not cover the others; hr.main covers them all", () => {
  const one = ctx({ adminRoutes: ["hr.main"], editRoutes: ["hr.leave"] })
  assert.equal(canEditRouteV2(one, "hr.leave"), true)
  assert.equal(canEditRouteV2(one, "hr.attendance"), false)
  const all = ctx({ adminRoutes: ["hr.main"], editRoutes: ["hr.main"] })
  assert.equal(canEditRouteV2(all, "hr.attendance"), true)
  assert.equal(canEditRouteV2(all, "hr.pms"), true)
})

test("edit never exceeds view: a grant without the route does not open it", () => {
  const c = ctx({ adminRoutes: [], editRoutes: ["hr.main"] })
  assert.equal(canAccessRouteV2(c, "hr.main"), false)
  assert.equal(canEditRouteV2(c, "hr.main"), false)
})

test("routes without an edit level keep view = edit", () => {
  const c = ctx({ adminRoutes: ["accounts.main"] })
  assert.equal(canEditRouteV2(c, "accounts.main"), true)
})

test("IT pages resolve to it.main on both the old and the new paths", () => {
  for (const path of [
    "/admin/it",
    "/admin/onboarding",
    "/admin/settings/mailboxes",
    "/admin/settings/mail",
    "/admin/accounts/starlink",
    "/admin/it/mailboxes",
    "/admin/it/starlink",
  ]) {
    assert.equal(resolveAdminRouteKeyV2(path), "it.main", path)
  }
  // Network Activity and Bypass & Override keep their own keys inside the IT console.
  assert.equal(resolveAdminRouteKeyV2("/admin/it/network-activity"), "security.networkActivity")
  assert.equal(resolveAdminRouteKeyV2("/admin/it/bypass-override"), "security.bypassOverride")
  assert.equal(resolveAdminRouteKeyV2("/admin/security/network-activity"), "security.networkActivity")
  assert.equal(resolveAdminRouteKeyV2("/admin/settings/users"), "settings.main")
  assert.equal(resolveAdminRouteKeyV2("/admin/accounts/requisitions"), "accounts.main")
})

test("API edit routes: mailbox, starlink, HR sections; appeals and unguarded paths are exempt", () => {
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/mailboxes/password"), "it.main")
  assert.equal(resolveApiEditRouteKeyV2("/api/starlink/kits"), "it.main")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/attendance/records"), "hr.attendance")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/leave/manual"), "hr.leave")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/employees/abc/profile"), "hr.main")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/performance/cbt/attempts"), "hr.pms.cbt.manage")
  // Appeals are decided by stage rules, not page edit.
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/attendance/appeals"), null)
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/assets"), null)
  assert.equal(resolveApiEditRouteKeyV2("/api/v1/hr/employees/x/status"), null)
})
