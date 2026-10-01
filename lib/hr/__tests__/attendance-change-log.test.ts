import test from "node:test"
import assert from "node:assert/strict"
import { groupChangeLogEntries, splitChangeComment, type ChangeLogEntry } from "@/lib/hr/attendance-change-log"

test("a typed comment is shown exactly as typed", () => {
  assert.deepEqual(splitChangeComment({ comment: "Allowed", metadata: null }), { comment: "Allowed", details: null })
})

test("the system's wording is kept out of the comment", () => {
  assert.deepEqual(
    splitChangeComment({
      comment: "Site visit, Abuja",
      metadata: { summary: "Resolved manually: day set to Out of Station" },
    }),
    { comment: "Site visit, Abuja", details: "Resolved manually: day set to Out of Station" }
  )
})

test("a system-only change has no comment", () => {
  assert.deepEqual(splitChangeComment({ comment: null, metadata: { summary: "Exemption stopped." } }), {
    comment: null,
    details: "Exemption stopped.",
  })
})

test("older rows that stored the system's wording as the comment are recognised", () => {
  const backfilled =
    "Resolved manually: day set to Out of Station by Rafiat Egunjobi on 19 Aug 2026 (backfilled 1 Oct 2026)"
  assert.deepEqual(splitChangeComment({ comment: backfilled, metadata: { appeal_id: "x" } }), {
    comment: null,
    details: backfilled,
  })
})

const entry = (overrides: Partial<ChangeLogEntry> = {}): ChangeLogEntry => ({
  id: "e1",
  changed_at: "2026-09-19T09:04:00Z",
  day: "2026-09-01",
  event_type: "bulk_grant",
  category: "out_of_station",
  change_label: "Out-of-station directive",
  actor_id: "rafiat",
  actor_name: "Rafiat Egunjobi",
  employee_id: "elijah",
  employee_name: "Elijah Isah",
  department: "Projects",
  from_status: null,
  to_status: "out_of_station",
  comment: "Site work, Abuja",
  details: null,
  appeal: null,
  ...overrides,
})

test("one bulk change to one person becomes one row covering every day", () => {
  const days = ["2026-09-03", "2026-09-02", "2026-09-01"]
  const rows = groupChangeLogEntries(days.map((day, i) => entry({ id: `e${i}`, day })))
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].days, ["2026-09-01", "2026-09-02", "2026-09-03"])
  assert.equal(rows[0].day_from, "2026-09-01")
  assert.equal(rows[0].day_to, "2026-09-03")
})

test("one bulk change to several people stays one row per person", () => {
  const rows = groupChangeLogEntries([
    entry({ id: "a1", employee_id: "a", day: "2026-09-01" }),
    entry({ id: "b1", employee_id: "b", day: "2026-09-01" }),
    entry({ id: "a2", employee_id: "a", day: "2026-09-02" }),
    entry({ id: "b2", employee_id: "b", day: "2026-09-02" }),
  ])
  assert.equal(rows.length, 2)
  assert.deepEqual(
    rows.map((row) => row.days.length),
    [2, 2]
  )
})

test("a different comment, result or a later save is a separate change", () => {
  const rows = groupChangeLogEntries([
    entry({ id: "1", day: "2026-09-01" }),
    entry({ id: "2", day: "2026-09-02", comment: "Different reason" }),
    entry({ id: "3", day: "2026-09-03", to_status: "absent_with_permission" }),
    entry({ id: "4", day: "2026-09-04", changed_at: "2026-09-18T09:00:00Z" }),
  ])
  assert.equal(rows.length, 4)
})

test("days that started from different statuses show as mixed", () => {
  const rows = groupChangeLogEntries([
    entry({ id: "1", day: "2026-09-01", from_status: "late" }),
    entry({ id: "2", day: "2026-09-02", from_status: "absent" }),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].from_mixed, true)
  assert.equal(rows[0].from_status, null)
})

test("single-day edits only merge when they changed the same thing", () => {
  const edit = (id: string, day: string, from: string) =>
    entry({
      id,
      day,
      event_type: "manual_update",
      category: "edits",
      from_status: from,
      to_status: "lateness_with_permission",
      comment: "Allowed",
    })
  const rows = groupChangeLogEntries([
    edit("1", "2026-09-21", "late"),
    edit("2", "2026-09-22", "late"),
    edit("3", "2026-09-23", "absent"),
  ])
  assert.equal(rows.length, 2)
})
