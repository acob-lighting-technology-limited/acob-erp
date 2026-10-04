import { test } from "node:test"
import assert from "node:assert/strict"
import { AttendancePolicySchema } from "../attendance-policy-schema"

const valid = {
  startTime: "08:00",
  endTime: "17:00",
  lateCutoff: "08:20",
  incompletePenalty: 1,
  lunchMinutes: 30,
  lunchQualifyingHours: 5,
  emailNotificationsEnabled: true,
}

const issuesFor = (input: unknown) => {
  const result = AttendancePolicySchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
}

test("accepts the default policy", () => {
  assert.deepEqual(issuesFor(valid), [])
})

test("rejects a grace cutoff before opening, on the cutoff field", () => {
  assert.deepEqual(issuesFor({ ...valid, lateCutoff: "07:45" }), [
    "lateCutoff: Grace cutoff time must be after the workday start time.",
  ])
})

test("allows a grace cutoff equal to opening", () => {
  assert.deepEqual(issuesFor({ ...valid, lateCutoff: "08:00" }), [])
})

test("rejects an end time at or before the start, on the end field", () => {
  assert.deepEqual(issuesFor({ ...valid, endTime: "08:00" }), [
    "endTime: Workday end time must be after the workday start time.",
  ])
})

test("an empty number input (NaN) gets a readable message", () => {
  assert.deepEqual(issuesFor({ ...valid, lunchMinutes: Number.NaN }), ["lunchMinutes: Enter a number of minutes"])
})
