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

test("validateLwpAwpMonthlyQuota: LWP/AWP quota blocks employee after 3 permission days", async () => {
  const mockClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            gte: () => ({
              lte: () => Promise.resolve({ count: 3, error: null }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient

  const result = await validateLwpAwpMonthlyQuota({
    dataClient: mockClient,
    userId: "user-123",
    targetStatus: "lateness_with_permission",
    date: "2026-10-24",
    isAdminLike: false,
    isManualAlteration: false,
  })

  assert.equal(result.allowed, false)
  assert.match(result.error ?? "", /maximum of 3 LWP\/AWP permissions/)
})
