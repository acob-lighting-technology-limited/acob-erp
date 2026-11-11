import test from "node:test"
import assert from "node:assert/strict"
import { groupRecords, idsLeavingRange, type ManualRecord } from "@/lib/hr/manual-entry-groups"

const rec = (id: string, date: string, comment = "Field", user = "u1"): ManualRecord => ({
  id,
  user_id: user,
  user_name: "Daniel",
  date,
  manual_comment: comment,
})

test("contiguous days with one comment become one range, weekends bridged", () => {
  const groups = groupRecords([rec("a", "2026-11-06"), rec("b", "2026-11-09"), rec("c", "2026-11-10")])
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].ids, ["a", "b", "c"])
  assert.deepEqual(groups[0].dates, ["2026-11-06", "2026-11-09", "2026-11-10"])
  assert.equal(groups[0].start, "2026-11-06")
  assert.equal(groups[0].end, "2026-11-10")
})

test("a real gap or a different comment splits the entry", () => {
  const groups = groupRecords([rec("a", "2026-11-02"), rec("b", "2026-11-12"), rec("c", "2026-11-03", "Other")])
  assert.equal(groups.length, 3)
})

test("an edit takes away only the days that fall outside the new range", () => {
  const [group] = groupRecords([
    rec("a", "2026-11-05"),
    rec("b", "2026-11-06"),
    rec("c", "2026-11-09"),
    rec("d", "2026-11-10"),
  ])
  assert.deepEqual(idsLeavingRange(group, "2026-11-06", "2026-11-09"), ["a", "d"])
})

test("an edit that keeps every day takes nothing away", () => {
  const [group] = groupRecords([rec("a", "2026-11-05"), rec("b", "2026-11-06")])
  assert.deepEqual(idsLeavingRange(group, "2026-11-01", "2026-11-30"), [])
})
