import { test } from "node:test"
import assert from "node:assert/strict"
import { validateLwpAwpMonthlyQuota } from "@/lib/hr/attendance-quota"
import type { SupabaseClient } from "@supabase/supabase-js"

test("validateLwpAwpMonthlyQuota: Out of Station (OOS) is uncapped", async () => {
  const mockClient = {
    from: () => {
      throw new Error("Should not query DB for uncapped statuses")
    },
  } as unknown as SupabaseClient

  const result = await validateLwpAwpMonthlyQuota({
    dataClient: mockClient,
    userId: "user-123",
    targetStatus: "out_of_station",
    date: "2026-10-24",
    isAdminLike: false,
  })

  assert.equal(result.allowed, true)
})

test("validateLwpAwpMonthlyQuota: Admin manual alterations are uncapped", async () => {
  const mockClient = {
    from: () => {
      throw new Error("Should not query DB for admin manual alterations")
    },
  } as unknown as SupabaseClient

  const result = await validateLwpAwpMonthlyQuota({
    dataClient: mockClient,
    userId: "user-123",
    targetStatus: "absent_with_permission",
    date: "2026-10-24",
    isAdminLike: false,
    isManualAlteration: true,
  })

  assert.equal(result.allowed, true)
})

/** A query builder whose every step returns itself and which resolves to `result` when awaited. */
function chain(result: unknown) {
  const node: Record<string, unknown> = {}
  const step = () => node
  for (const name of ["select", "eq", "neq", "in", "gte", "lte", "returns"]) node[name] = step
  node.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return node
}

function quotaClient(permissionDates: string[], resolvedDates: string[]) {
  return {
    from: (table: string) =>
      table === "attendance_records"
        ? chain({ data: permissionDates.map((date, index) => ({ id: `r${index}`, date })), error: null })
        : chain({ data: resolvedDates.map((appeal_date) => ({ appeal_date })), error: null }),
  } as unknown as SupabaseClient
}

const QUOTA_REQUEST = {
  userId: "user-123",
  targetStatus: "lateness_with_permission",
  date: "2026-10-24",
  isAdminLike: false,
  isManualAlteration: false,
}

test("validateLwpAwpMonthlyQuota: LWP/AWP quota blocks employee after 3 permission days", async () => {
  const result = await validateLwpAwpMonthlyQuota({
    ...QUOTA_REQUEST,
    dataClient: quotaClient(["2026-10-01", "2026-10-02", "2026-10-03"], []),
  })

  assert.equal(result.allowed, false)
  assert.match(result.error ?? "", /maximum of 3 LWP\/AWP permissions/)
})

test("validateLwpAwpMonthlyQuota: days whose appeal ended resolved do not count", async () => {
  const result = await validateLwpAwpMonthlyQuota({
    ...QUOTA_REQUEST,
    // Three permission days, but one was closed outside the appeal (a device fault): only two count.
    dataClient: quotaClient(["2026-10-01", "2026-10-02", "2026-10-30"], ["2026-10-30"]),
  })

  assert.equal(result.allowed, true)
})
