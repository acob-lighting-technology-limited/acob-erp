import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAccessContextV2, editDelegatorV2, editModeV2 } from "@/lib/admin/policy-v2"
import { summariseOverrideChanges, type OverrideChange } from "@/lib/admin/override-report"
import { resolveOnBehalfOf } from "@/lib/audit/on-behalf-of"
import type { AuditRequestContext } from "@/lib/audit/request-context"
import { confirmDestructiveIfOverride, isDestructiveCall, setOverrideConfirmer } from "@/lib/override-confirm"

const change = (userId: string | null): OverrideChange => ({
  userId,
  area: "it",
  action: "update",
  entityType: "mailbox",
  createdAt: "2026-10-05T10:00:00Z",
})

test("the monthly summary counts changes per person, busiest first", () => {
  const names = new Map([
    ["a", "Rafiat Egunjobi"],
    ["b", "Peter Ayoola"],
  ])
  const text = summariseOverrideChanges([change("a"), change("b"), change("a"), change(null)], names)
  assert.equal(text, "2 by Rafiat Egunjobi, 1 by Peter Ayoola, 1 by someone")
})

test("a delegate's change names the owner who lent them the access", () => {
  const delegate = buildAccessContextV2({
    role: "admin",
    isDepartmentLead: false,
    isAdminLike: true,
    adminRoutes: ["hr.main"],
    scopeMode: "global",
    managedDepartments: [],
    editRoutes: ["hr.lunch"],
    editDelegators: { "hr.lunch": "owner-1" },
  })
  assert.equal(editModeV2(delegate, "hr.lunch"), "delegate")
  assert.equal(editDelegatorV2(delegate, "hr.lunch"), "owner-1")
  assert.equal(editDelegatorV2(delegate, "hr.leave"), null)
})

test("a delegation on the whole of HR names the owner for every HR page", () => {
  const delegate = buildAccessContextV2({
    role: "admin",
    isDepartmentLead: false,
    isAdminLike: true,
    adminRoutes: ["hr.main"],
    scopeMode: "global",
    managedDepartments: [],
    editRoutes: ["hr.main"],
    editDelegators: { "hr.main": "owner-1" },
  })
  assert.equal(editDelegatorV2(delegate, "hr.attendance"), "owner-1")
})

function lookupClient(tables: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const row = tables[table] ?? null
      const node: Record<string, unknown> = {}
      for (const name of ["select", "eq", "is", "gt", "limit"]) node[name] = () => node
      node.maybeSingle = () => Promise.resolve({ data: row, error: null })
      return node
    },
  } as unknown as SupabaseClient
}

const BASE: AuditRequestContext = {
  ipAddress: null,
  userAgent: null,
  editMode: null,
  editArea: null,
  onBehalfOfId: null,
  deptContextId: null,
}

test("on behalf of: an admin delegate is named from the middleware header", async () => {
  const client = lookupClient({ staff_directory: { full_name: "Onyekachukwu Atishie" } })
  const result = await resolveOnBehalfOf(client, { ...BASE, editMode: "delegate", onBehalfOfId: "owner-1" }, "rafiat")
  assert.deepEqual(result, { id: "owner-1", name: "Onyekachukwu Atishie" })
})

test("on behalf of: a department-console delegate is found from the live delegation", async () => {
  const client = lookupClient({
    dept_delegations: { delegator_id: "lead-1" },
    staff_directory: { full_name: "Onyekachukwu Atishie" },
  })
  const result = await resolveOnBehalfOf(client, { ...BASE, deptContextId: "dept-1" }, "rafiat")
  assert.deepEqual(result, { id: "lead-1", name: "Onyekachukwu Atishie" })
})

test("on behalf of: a lead, with no delegation, gets nothing added", async () => {
  const client = lookupClient({})
  assert.equal(await resolveOnBehalfOf(client, { ...BASE, deptContextId: "dept-1" }, "lead-1"), null)
  assert.equal(await resolveOnBehalfOf(client, BASE, "someone"), null)
})

test("only things that cannot be undone ask an override holder to confirm", async () => {
  assert.equal(isDestructiveCall("DELETE", "/api/admin/hr/lunch/menus/1"), true)
  assert.equal(isDestructiveCall("POST", "/api/admin/mailboxes/abc/suspend"), true)
  assert.equal(isDestructiveCall("POST", "/api/admin/hr/lunch/menus"), false)
  assert.equal(isDestructiveCall("GET", "/api/admin/hr/lunch/menus"), false)

  // Nobody to ask: it goes ahead.
  setOverrideConfirmer(null)
  assert.equal(await confirmDestructiveIfOverride("DELETE", "/api/x"), true)

  let asked = 0
  setOverrideConfirmer(async () => {
    asked += 1
    return false
  })
  assert.equal(await confirmDestructiveIfOverride("DELETE", "/api/x"), false)
  assert.equal(await confirmDestructiveIfOverride("POST", "/api/x"), true)
  assert.equal(asked, 1)
  setOverrideConfirmer(null)
})
