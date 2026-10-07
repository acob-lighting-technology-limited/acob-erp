import test from "node:test"
import assert from "node:assert/strict"
import { isClientNoise } from "../noise"

test("browser and extension noise is dropped", () => {
  assert.ok(isClientNoise("ResizeObserver loop completed with undelivered notifications."))
  assert.ok(isClientNoise("ResizeObserver loop limit exceeded"))
  assert.ok(isClientNoise("Script error."))
  assert.ok(isClientNoise("Cannot read properties of undefined (reading 'sendMessage')"))
  assert.ok(isClientNoise("boom", "TypeError: boom\n    at chrome-extension://abcdef/content.js:1:2"))
})

test("real failures and deploy or hydration signals are still reported", () => {
  for (const message of [
    "confirmingId is not defined",
    "GET /api/tasks failed (500)",
    "Loading chunk 23146 failed.",
    "Minified React error #418; visit https://react.dev/errors/418",
    "Script error in report export",
  ]) {
    assert.equal(
      isClientNoise(message, "TypeError: x\n    at https://matrix.acoblighting.com/_next/static/chunks/1.js"),
      false
    )
  }
})
