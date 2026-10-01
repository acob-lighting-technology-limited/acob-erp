import test from "node:test"
import assert from "node:assert/strict"
import type { SupabaseClient } from "@supabase/supabase-js"
import { closeAppealsMadeMootByDevice, resolvePendingAppealsOnManualStatus } from "@/lib/hr/attendance-appeals"
import { DEFAULT_ATTENDANCE_POLICY } from "@/lib/org-config"

type Appeal = {
  id: string
  user_id: string
  appeal_date: string
  current_status: string
  requested_status: string
  appeal_reason: string
  status: string
  resolution_note?: string | null
}

type DayRecord = {
  id: string
  user_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  status: string | null
  waived: boolean | null
}

/**
 * Just enough of the Supabase query builder for the resolvers: they read
 * pending appeals and the day's record, update appeals by id, and write
 * events/notifications we ignore.
 */
function fakeClient(appeals: Appeal[], records: DayRecord[] = []) {
  const notifications: Array<Record<string, unknown>> = []

  const builder = (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: Array<(row: any) => boolean> = []
    let patch: Record<string, unknown> | null = null
    let single = false
    const api = {
      select: () => api,
      insert: () => api,
      returns: () => api,
      maybeSingle: () => {
        single = true
        return api
      },
      update: (values: Record<string, unknown>) => {
        patch = values
        return api
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value)
        return api
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]))
        return api
      },
      then: (resolve: (value: { data: unknown; error: null }) => void) => {
        if (table === "attendance_records") {
          const match = records.filter((row) => filters.every((filter) => filter(row)))
          return resolve({ data: single ? (match[0] ?? null) : match, error: null })
        }
        if (table !== "attendance_appeals") return resolve({ data: null, error: null })
        const matching = appeals.filter((row) => filters.every((filter) => filter(row)))
        if (patch) for (const row of matching) Object.assign(row, patch)
        resolve({ data: matching.map((row) => ({ ...row })), error: null })
      },
    }
    return api
  }

  const client = {
    from: builder,
    rpc: async (_name: string, args: Record<string, unknown>) => {
      notifications.push(args)
      return { data: null, error: null }
    },
  } as unknown as SupabaseClient

  return { client, notifications }
}

const lateAppeal = (overrides: Partial<Appeal> = {}): Appeal => ({
  id: "a1",
  user_id: "u1",
  appeal_date: "2026-09-24",
  current_status: "late",
  requested_status: "lateness_with_permission",
  appeal_reason: "Traffic on the expressway",
  status: "pending",
  ...overrides,
})

test("a manual edit to the requested status resolves the appeal, not approves it", async () => {
  const appeal = lateAppeal()
  const { client, notifications } = fakeClient([appeal])

  await resolvePendingAppealsOnManualStatus(client, {
    userId: "u1",
    dates: ["2026-09-24"],
    status: "lateness_with_permission",
    actorId: "hr",
  })

  assert.equal(appeal.status, "resolved")
  assert.match(String(appeal.resolution_note), /^Resolved manually: day set to /)
  assert.equal(notifications.length, 1, "the employee is told in-app")
})

test("a manual edit to a different status resolves it and records what was set", async () => {
  const appeal = lateAppeal()
  const { client } = fakeClient([appeal])

  await resolvePendingAppealsOnManualStatus(client, {
    userId: "u1",
    dates: ["2026-09-24"],
    status: "out_of_station",
    comment: "Site visit, Abuja",
    actorId: "hr",
  })

  assert.equal(appeal.status, "resolved")
  assert.match(String(appeal.resolution_note), /Site visit, Abuja$/)
})

test("an edit that keeps the appealed status (a clock-time fix) leaves the appeal pending", async () => {
  const appeal = lateAppeal()
  const { client, notifications } = fakeClient([appeal])

  await resolvePendingAppealsOnManualStatus(client, {
    userId: "u1",
    dates: ["2026-09-24"],
    status: "late",
    actorId: "hr",
  })

  assert.equal(appeal.status, "pending")
  assert.equal(notifications.length, 0)
})

test("a bulk range resolves only pending appeals for that person on those days", async () => {
  const inRange = lateAppeal({ id: "in-range" })
  const otherDay = lateAppeal({ id: "other-day", appeal_date: "2026-09-10" })
  const otherPerson = lateAppeal({ id: "other-person", user_id: "u2" })
  const alreadyRejected = lateAppeal({ id: "rejected", appeal_date: "2026-09-25", status: "rejected" })
  const { client } = fakeClient([inRange, otherDay, otherPerson, alreadyRejected])

  await resolvePendingAppealsOnManualStatus(client, {
    userId: "u1",
    dates: ["2026-09-24", "2026-09-25", "2026-09-26"],
    status: "out_of_station",
    actorId: "hr",
  })

  assert.equal(inRange.status, "resolved")
  assert.equal(otherDay.status, "pending")
  assert.equal(otherPerson.status, "pending")
  assert.equal(alreadyRejected.status, "rejected")
})

const outageRecord = (overrides: Partial<DayRecord> = {}): DayRecord => ({
  id: "r1",
  user_id: "u1",
  date: "2026-09-28",
  clock_in: "07:49:43",
  clock_out: "17:20:55",
  status: "present",
  waived: false,
  ...overrides,
})

test("a late clock-out that completes the day closes the incomplete appeal", async () => {
  // Oghenerune, 28 Sep 2026: marked incomplete overnight, appealed at 09:00,
  // and the 17:20 clock-out arrived from the device at 10:10.
  const appeal = lateAppeal({
    appeal_date: "2026-09-28",
    current_status: "incomplete",
    requested_status: "incomplete_with_permission",
  })
  const { client, notifications } = fakeClient([appeal], [outageRecord()])

  await closeAppealsMadeMootByDevice(client, { userId: "u1", date: "2026-09-28", policy: DEFAULT_ATTENDANCE_POLICY })

  assert.equal(appeal.status, "resolved")
  assert.match(String(appeal.resolution_note), /arrived from the device/)
  assert.equal(notifications.length, 1)
})

test("a late punch that leaves the day still appealable keeps the appeal for a reviewer", async () => {
  const appeal = lateAppeal({
    appeal_date: "2026-09-28",
    current_status: "incomplete",
    requested_status: "incomplete_with_permission",
  })
  // Clock-in at 10:30 is late whatever the clock-out says.
  const { client, notifications } = fakeClient([appeal], [outageRecord({ clock_in: "10:30:00" })])

  await closeAppealsMadeMootByDevice(client, { userId: "u1", date: "2026-09-28", policy: DEFAULT_ATTENDANCE_POLICY })

  assert.equal(appeal.status, "pending")
  assert.equal(notifications.length, 0)
})
