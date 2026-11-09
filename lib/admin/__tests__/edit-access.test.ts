import assert from "node:assert/strict"
import test from "node:test"
import {
  buildAccessContextV2,
  canAccessRouteV2,
  canEditRouteV2,
  editModeV2,
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

test("an owner of HR edits HR without any grant", () => {
  const c = ctx({ role: "super_admin", adminRoutes: null, ownedAreas: ["hr"] })
  assert.equal(canEditRouteV2(c, "hr.attendance"), true)
  assert.equal(canEditRouteV2(c, "hr.leave"), true)
})

test("owning one area gives no edit on another", () => {
  const hr = ctx({ role: "super_admin", adminRoutes: null, ownedAreas: ["hr"] })
  const it = ctx({ role: "super_admin", adminRoutes: null, ownedAreas: ["it"] })
  const cs = ctx({ role: "super_admin", adminRoutes: null, ownedAreas: ["corporate_services"] })
  assert.equal(canEditRouteV2(hr, "hr.main"), true)
  assert.equal(canEditRouteV2(hr, "it.main"), false)
  assert.equal(canEditRouteV2(it, "it.main"), true)
  assert.equal(canEditRouteV2(it, "hr.main"), false)
  assert.equal(canEditRouteV2(cs, "scorecard.main"), true)
  // The Corporate Services owner has no say over HR any more.
  assert.equal(canEditRouteV2(cs, "hr.main"), false)
})

test("leading a department gives no ownership by itself", () => {
  const lead = ctx({
    role: "super_admin",
    isDepartmentLead: true,
    adminRoutes: null,
    department: "Admin and HR",
    leadDepartments: ["Admin and HR"],
  })
  assert.equal(canEditRouteV2(lead, "hr.main"), false)
  assert.equal(canEditRouteV2(lead, "it.main"), false)
})

test("edit mode: owner, delegate (acting for an owner) and override are told apart", () => {
  const owner = ctx({ adminRoutes: ["hr.main"], ownedAreas: ["hr"] })
  const delegate = ctx({ adminRoutes: ["hr.main"], editRoutes: ["hr.attendance"], editOverrideRoutes: [] })
  const override = ctx({ adminRoutes: ["hr.main"], editRoutes: ["hr.main"], editOverrideRoutes: ["hr.main"] })
  const viewer = ctx({ adminRoutes: ["hr.main"] })
  assert.equal(editModeV2(owner, "hr.attendance"), "owner")
  assert.equal(editModeV2(delegate, "hr.attendance"), "delegate")
  assert.equal(editModeV2(override, "hr.attendance"), "override")
  assert.equal(editModeV2(viewer, "hr.attendance"), null)
  // Acting for an owner wins over an override held on the same route.
  const both = ctx({ adminRoutes: ["hr.main"], editRoutes: ["hr.main"], editOverrideRoutes: [] })
  assert.equal(editModeV2(both, "hr.main"), "delegate")
})

test("Corporate Services is a guarded area: view is not edit there either", () => {
  const viewer = ctx({ adminRoutes: ["scorecard.main"] })
  assert.equal(canAccessRouteV2(viewer, "scorecard.main"), true)
  assert.equal(canEditRouteV2(viewer, "scorecard.main"), false)
  assert.equal(resolveApiEditRouteKeyV2("/api/corporate-scorecard/kpis"), "scorecard.main")
  assert.equal(resolveApiEditRouteKeyV2("/api/corporate-services/risk-register"), "scorecard.main")
  // Staff entering their own actuals is not a management change.
  assert.equal(resolveApiEditRouteKeyV2("/api/corporate-scorecard/actuals"), null)
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
  // Payroll, Inventory and Assets keep their own keys under /admin/accounts.
  assert.equal(resolveAdminRouteKeyV2("/admin/accounts/payroll/abc"), "payroll.main")
  assert.equal(resolveAdminRouteKeyV2("/admin/accounts/inventory/products"), "inventory.main")
  assert.equal(resolveAdminRouteKeyV2("/admin/accounts/assets"), "assets.main")
  assert.equal(resolveAdminRouteKeyV2("/admin/accounts/assets/issues"), "assets.issues")
  assert.equal(resolveAdminRouteKeyV2("/admin/payroll"), "payroll.main")
  // Attendance and CBT settings are HR pages now.
  assert.equal(resolveAdminRouteKeyV2("/admin/hr/attendance/settings"), "hr.attendance")
  assert.equal(resolveAdminRouteKeyV2("/admin/hr/pms/cbt/settings"), "hr.pms.cbt.manage")
  assert.equal(resolveAdminRouteKeyV2("/admin/settings/cbt"), "hr.pms.cbt.manage")
  assert.equal(resolveAdminRouteKeyV2("/admin/settings/users"), "settings.main")
  assert.equal(resolveAdminRouteKeyV2("/admin/accounts/requisitions"), "accounts.main")
})

test("API edit routes: mailbox, starlink, HR sections; appeals and unguarded paths are exempt", () => {
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/mailboxes/quota"), "it.main")
  assert.equal(resolveApiEditRouteKeyV2("/api/starlink/kits"), "it.main")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/attendance/records"), "hr.attendance")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/leave/manual"), "hr.leave")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/employees/abc/profile"), "hr.employees")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/performance/cbt/attempts"), "hr.pms.cbt.manage")
  // Appeals are decided by stage rules, not page edit.
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/attendance/appeals"), null)
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/department-leads"), null)
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/assets"), null)
  assert.equal(resolveApiEditRouteKeyV2("/api/v1/hr/employees/x/status"), null)
})

test("a delegate holding only Employees can change employees, not departments or lunch", () => {
  const c = ctx({ adminRoutes: ["hr.main"], editRoutes: ["hr.employees"] })
  assert.equal(canEditRouteV2(c, "hr.employees"), true)
  assert.equal(canEditRouteV2(c, "hr.departments"), false)
  assert.equal(canEditRouteV2(c, "hr.lunch"), false)
})

test("editing the whole of HR covers the single pages, and an owner edits every page", () => {
  const all = ctx({ adminRoutes: ["hr.main"], editRoutes: ["hr.main"] })
  for (const route of ["hr.employees", "hr.departments", "hr.lunch", "hr.offices"] as const) {
    assert.equal(canEditRouteV2(all, route), true)
  }
  const lead = ctx({ role: "super_admin", adminRoutes: null, ownedAreas: ["hr"] })
  assert.equal(canEditRouteV2(lead, "hr.offices"), true)
})

test("the HR page APIs map to their own edit area", () => {
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/employees"), "hr.employees")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/departments"), "hr.departments")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/lunch/menus/1"), "hr.lunch")
  assert.equal(resolveApiEditRouteKeyV2("/api/admin/hr/office-locations"), "hr.offices")
})

test("MD's Desk is a guarded area like the others: owner, acting for the owner, override, or view only", () => {
  const viewer = ctx({ adminRoutes: [] })
  assert.equal(canAccessRouteV2(viewer, "mddesk.main"), true)
  assert.equal(canEditRouteV2(viewer, "mddesk.main"), false)

  const md = ctx({ role: "super_admin", adminRoutes: null, ownedAreas: ["md_desk"] })
  assert.equal(editModeV2(md, "mddesk.main"), "owner")

  const delegate = ctx({ editRoutes: ["mddesk.main"], editOverrideRoutes: [], editDelegators: { "mddesk.main": "md" } })
  assert.equal(editModeV2(delegate, "mddesk.main"), "delegate")

  const override = ctx({ editRoutes: ["mddesk.main"], editOverrideRoutes: ["mddesk.main"] })
  assert.equal(editModeV2(override, "mddesk.main"), "override")

  // Owning another area gives no say over MD's Desk.
  const hr = ctx({ role: "super_admin", adminRoutes: null, ownedAreas: ["hr"] })
  assert.equal(canEditRouteV2(hr, "mddesk.main"), false)
  assert.equal(resolveApiEditRouteKeyV2("/api/md-desk/task-reviews"), "mddesk.main")
})
