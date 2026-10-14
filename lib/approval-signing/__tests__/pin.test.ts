import { test } from "node:test"
import assert from "node:assert/strict"
import { generateResetCode, hashSecret, isLocked, pinProblem, verifySecret } from "../pin"

test("PIN rules", () => {
  assert.equal(pinProblem("481920"), null)
  assert.match(pinProblem("12345") || "", /exactly 6/)
  assert.match(pinProblem("12a456") || "", /exactly 6/)
  assert.match(pinProblem("777777") || "", /repeated/)
  assert.match(pinProblem("123456") || "", /sequence/)
  assert.match(pinProblem("654321") || "", /sequence/)
  assert.match(pinProblem("890123") || "", /sequence/)
})

test("hash verifies only the same secret, with a fresh salt each time", async () => {
  const a = await hashSecret("481920")
  const b = await hashSecret("481920")
  assert.notEqual(a, b)
  assert.equal(await verifySecret("481920", a), true)
  assert.equal(await verifySecret("481921", a), false)
  assert.equal(await verifySecret("481920", null), false)
  assert.equal(await verifySecret("481920", "garbage"), false)
})

test("reset codes are six digits", () => {
  for (let i = 0; i < 50; i++) assert.match(generateResetCode(), /^\d{6}$/)
})

test("lockout window", () => {
  const now = new Date("2026-10-13T10:00:00Z")
  assert.equal(isLocked("2026-10-13T10:05:00Z", now), true)
  assert.equal(isLocked("2026-10-13T09:55:00Z", now), false)
  assert.equal(isLocked(null, now), false)
})
