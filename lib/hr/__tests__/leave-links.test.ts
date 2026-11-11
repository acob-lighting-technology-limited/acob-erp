import test from "node:test"
import assert from "node:assert/strict"
import { LEAVE_REVIEWS_PATH, parseLeaveTab } from "@/lib/hr/leave-links"

test("the approver link opens the Pending Reviews tab", () => {
  const url = new URL(LEAVE_REVIEWS_PATH, "https://example.test")
  assert.equal(url.pathname, "/hr/leave")
  assert.equal(parseLeaveTab(url.searchParams.get("tab")), "reviews")
})

test("known tabs are honoured", () => {
  assert.equal(parseLeaveTab("reviews"), "reviews")
  assert.equal(parseLeaveTab("reviewed"), "reviewed")
  assert.equal(parseLeaveTab("my-requests"), "my-requests")
})

test("a missing, repeated or unknown tab falls back to My Requests", () => {
  assert.equal(parseLeaveTab(undefined), "my-requests")
  assert.equal(parseLeaveTab(null), "my-requests")
  assert.equal(parseLeaveTab(""), "my-requests")
  assert.equal(parseLeaveTab("admin"), "my-requests")
  assert.equal(parseLeaveTab(["reviews", "reviewed"]), "reviews")
})
