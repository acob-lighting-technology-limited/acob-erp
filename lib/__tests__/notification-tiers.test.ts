import { test } from "node:test"
import assert from "node:assert/strict"
import { isStaleFyi, notificationTier } from "../notifications/tiers"

test("approvals and task work are action items", () => {
  for (const type of [
    "approval_request",
    "task_assigned",
    "task_awaiting_review",
    "task_needs_rating",
    "task_overdue",
  ]) {
    assert.equal(notificationTier({ type }), "action", type)
  }
})

test("announcements are their own tier", () => {
  assert.equal(notificationTier({ type: "announcement", priority: "urgent" }), "announcement")
})

test("other updates are FYI unless urgent", () => {
  assert.equal(notificationTier({ type: "task_completed" }), "fyi")
  assert.equal(notificationTier({ type: "system", priority: "urgent" }), "action")
  assert.equal(notificationTier({ type: null }), "fyi")
})

test("FYI goes stale after 14 days", () => {
  const now = Date.parse("2026-10-20T12:00:00Z")
  assert.equal(isStaleFyi({ created_at: "2026-10-10T12:00:00Z" }, now), false)
  assert.equal(isStaleFyi({ created_at: "2026-10-01T12:00:00Z" }, now), true)
})
