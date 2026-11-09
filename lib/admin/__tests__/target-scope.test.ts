import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminScope } from "@/lib/admin/rbac"
import {
  denyUnlessAssetInScope,
  denyUnlessEmployeeInScope,
  denyUnlessTicketInScope,
  departmentInScope,
} from "@/lib/admin/target-scope"

type Row = Record<string, unknown>

/** Just enough of the query builder: select().eq().eq().maybeSingle() over in-memory tables. */
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        async maybeSingle() {
          const row = (tables[table] ?? []).find((r) => filters.every(([c, v]) => r[c] === v))
          return { data: row ?? null, error: null }
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
}

function makeScope(overrides: Partial<AdminScope> = {}): AdminScope {
  return {
    userId: "lead-1",
    role: "employee",
    department: "Accounts",
    departmentId: "dept-1",
    officeLocation: null,
    isDepartmentLead: true,
    leadDepartments: ["Accounts"],
    managedDepartments: ["Accounts"],
    managedDepartmentIds: ["dept-1"],
    managedOffices: [],
    isAdminLike: false,
    adminRoutes: null,
    scopeMode: "lead",
    ...overrides,
  }
}

const globalAdmin = makeScope({ isAdminLike: true, isDepartmentLead: false, scopeMode: "global" })

test("departmentInScope: null scope is unrestricted, empty scope is nothing", () => {
  assert.equal(departmentInScope(null, "Anything"), true)
  assert.equal(departmentInScope([], "Accounts"), false)
  assert.equal(departmentInScope(["Accounts"], null), false)
  assert.equal(departmentInScope(["Accounts"], "accounts"), true)
  assert.equal(departmentInScope(["Accounts"], "Admin & HR"), false)
})

test("employee: a lead cannot reach another department's employee", async () => {
  const db = fakeDb({
    profiles: [
      { id: "mine", department: "Accounts" },
      { id: "theirs", department: "Technical" },
    ],
  })
  assert.equal(await denyUnlessEmployeeInScope(db, makeScope(), "mine"), null)
  assert.equal((await denyUnlessEmployeeInScope(db, makeScope(), "theirs"))?.status, 403)
  assert.equal((await denyUnlessEmployeeInScope(db, makeScope(), "missing"))?.status, 404)
})

test("employee: a global admin is not restricted, and a lead may open their own profile", async () => {
  const db = fakeDb({ profiles: [{ id: "theirs", department: "Technical" }] })
  assert.equal(await denyUnlessEmployeeInScope(db, globalAdmin, "theirs"), null)
  assert.equal(await denyUnlessEmployeeInScope(db, makeScope(), "lead-1"), null)
})

test("asset: owned by department, assigned to department, assignee or office are in scope", async () => {
  const db = fakeDb({
    assets: [
      { id: "owned", department: "Accounts" },
      { id: "to-dept", department: "Technical" },
      { id: "to-person", department: "Technical" },
      { id: "to-office", department: "Technical" },
      { id: "foreign", department: "Technical" },
      { id: "unassigned-foreign", department: "Technical" },
    ],
    asset_assignments: [
      { asset_id: "to-dept", is_current: true, department: "Accounts", assigned_to: null, office_location: null },
      { asset_id: "to-person", is_current: true, department: null, assigned_to: "p1", office_location: null },
      { asset_id: "to-office", is_current: true, department: null, assigned_to: null, office_location: "Room A" },
      { asset_id: "foreign", is_current: true, department: "Technical", assigned_to: "p2", office_location: "Room B" },
    ],
    profiles: [
      { id: "p1", department: "Accounts" },
      { id: "p2", department: "Technical" },
    ],
    office_locations: [
      { name: "Room A", department: "Accounts" },
      { name: "Room B", department: "Technical" },
    ],
  })
  const lead = makeScope()
  for (const id of ["owned", "to-dept", "to-person", "to-office"]) {
    assert.equal(await denyUnlessAssetInScope(db, lead, id), null, id)
  }
  assert.equal((await denyUnlessAssetInScope(db, lead, "foreign"))?.status, 403)
  assert.equal((await denyUnlessAssetInScope(db, lead, "unassigned-foreign"))?.status, 403)
  assert.equal((await denyUnlessAssetInScope(db, lead, "missing"))?.status, 404)
  assert.equal(await denyUnlessAssetInScope(db, globalAdmin, "foreign"), null)
})

test("ticket: serviced or raised by the lead's department is in scope", async () => {
  const db = fakeDb({
    help_desk_tickets: [
      { id: "svc", service_department: "Accounts", requester_id: "x" },
      { id: "req", service_department: "Technical", requester_id: "p1" },
      { id: "foreign", service_department: "Technical", requester_id: "p2" },
    ],
    profiles: [
      { id: "p1", department: "Accounts" },
      { id: "p2", department: "Technical" },
    ],
  })
  const lead = makeScope()
  assert.equal(await denyUnlessTicketInScope(db, lead, "svc"), null)
  assert.equal(await denyUnlessTicketInScope(db, lead, "req"), null)
  assert.equal((await denyUnlessTicketInScope(db, lead, "foreign"))?.status, 403)
  assert.equal((await denyUnlessTicketInScope(db, lead, "missing"))?.status, 404)
})
