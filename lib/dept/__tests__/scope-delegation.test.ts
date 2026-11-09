import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveDeptScope } from "@/lib/dept/scope"

/** A query builder whose steps return itself; `single` and awaiting resolve with the table's canned data. */
function client(tables: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const result = { data: tables[table] ?? null, error: null }
      const node: Record<string, unknown> = {}
      for (const name of ["select", "eq", "in", "is", "gt", "returns"]) node[name] = () => node
      node.single = () =>
        Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] : result.data, error: null })
      node.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return node
    },
  } as unknown as SupabaseClient
}

const DEPT = { id: "dept-1", name: "Admin and HR" }
const LEAD_PROFILE = {
  role: "super_admin",
  is_department_lead: true,
  lead_departments: ["Admin and HR"],
  department: "Admin and HR",
  department_id: "dept-1",
}
const STAFF_PROFILE = {
  role: "employee",
  is_department_lead: false,
  lead_departments: null,
  department: "Admin and HR",
  department_id: "dept-1",
}

test("the lead of a department gets a normal scope with no delegation", async () => {
  const scope = await resolveDeptScope(client({ profiles: LEAD_PROFILE, departments: DEPT }), "lead-1", "dept-1")
  assert.ok(scope)
  assert.equal(scope.delegation, undefined)
  assert.equal(scope.isAdminLike, true)
})

test("someone with a live delegation gets the department, limited to its pages, without the lead's admin role", async () => {
  const scope = await resolveDeptScope(
    client({
      profiles: STAFF_PROFILE,
      departments: DEPT,
      dept_delegations: [
        { delegator_id: "lead-1", pages: ["hr.attendance"], valid_until: "2027-01-31T23:59:59Z" },
        { delegator_id: "lead-1", pages: ["tasks"], valid_until: "2027-02-28T23:59:59Z" },
      ],
    }),
    "rafiat",
    "dept-1"
  )
  assert.ok(scope?.delegation)
  assert.deepEqual(scope.delegation.pages.sort(), ["hr.attendance", "tasks"])
  assert.equal(scope.delegation.fromUserId, "lead-1")
  assert.equal(scope.delegation.validUntil, "2027-02-28T23:59:59Z")
  assert.equal(scope.isAdminLike, false)
  assert.equal(scope.role, "employee")
})

test("a delegate who is an admin elsewhere still does not act as an admin inside the delegated department", async () => {
  const scope = await resolveDeptScope(
    client({
      profiles: { ...STAFF_PROFILE, role: "admin" },
      departments: DEPT,
      dept_delegations: [{ delegator_id: "lead-1", pages: ["tasks"], valid_until: "2027-01-31T23:59:59Z" }],
    }),
    "rafiat",
    "dept-1"
  )
  assert.equal(scope?.isAdminLike, false)
})

test("without a live delegation a non-lead gets nothing", async () => {
  const scope = await resolveDeptScope(
    client({ profiles: STAFF_PROFILE, departments: DEPT, dept_delegations: [] }),
    "rafiat",
    "dept-1"
  )
  assert.equal(scope, null)
})

test("a delegation that holds only admin-side pages does not open the department console", async () => {
  const scope = await resolveDeptScope(
    client({
      profiles: STAFF_PROFILE,
      departments: DEPT,
      dept_delegations: [{ delegator_id: "lead-1", pages: ["hr.lunch"], valid_until: "2027-01-31T23:59:59Z" }],
    }),
    "rafiat",
    "dept-1"
  )
  assert.equal(scope, null)
})
