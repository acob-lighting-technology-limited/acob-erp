import { strict as assert } from "node:assert"
import { test } from "node:test"
import { normalizePriority, priorityRank } from "../priority"

test("critical ranks first and low last", () => {
  const ranked = ["low", "critical", "medium", "high"].sort((a, b) => priorityRank(a) - priorityRank(b))
  assert.deepEqual(ranked, ["critical", "high", "medium", "low"])
})

test("a missing or unknown priority reads as medium instead of breaking the sort", () => {
  assert.equal(normalizePriority(null), "medium")
  assert.equal(normalizePriority("urgent"), "medium")
  assert.equal(priorityRank(undefined), priorityRank("medium"))
})
