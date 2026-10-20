import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError } from "../../api-client"
import { applyServerErrors } from "../server-errors"

function recorder() {
  const calls: Array<[string, string]> = []
  const setError = ((name: string, error: { message?: string }) => {
    calls.push([name, error.message ?? ""])
  }) as Parameters<typeof applyServerErrors>[1]
  return { calls, setError }
}

test("field messages go under their fields and suppress the toast", () => {
  const { calls, setError } = recorder()
  const err = new ApiError("Email is required", 400, { email: "Email is required" })
  assert.equal(applyServerErrors(err, setError, ["email", "role"]), null)
  assert.deepEqual(calls, [["email", "Email is required"]])
})

test("nested paths match on their top-level field", () => {
  const { calls, setError } = recorder()
  const err = new ApiError("Bad segment", 400, { "segments.0.start_date": "Bad segment" })
  assert.equal(applyServerErrors(err, setError, ["segments"]), null)
  assert.deepEqual(calls, [["segments.0.start_date", "Bad segment"]])
})

test("errors for fields the form does not have fall back to a toast message", () => {
  const { calls, setError } = recorder()
  const err = new ApiError("You do not have permission to do this.", 403, { _: "nope" })
  assert.equal(applyServerErrors(err, setError, ["email"]), "You do not have permission to do this.")
  assert.deepEqual(calls, [])
})

test("non-API errors return their message", () => {
  const { setError } = recorder()
  assert.equal(applyServerErrors(new Error("Network down"), setError, ["email"]), "Network down")
})
