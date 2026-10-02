import assert from "node:assert/strict"
import test from "node:test"
import { pickCanonicalReview, reviewStatusPriority } from "@/lib/pms/reviews"

test("reviewStatusPriority orders completed > submitted > draft > other", () => {
  assert.ok(reviewStatusPriority("completed") > reviewStatusPriority("submitted"))
  assert.ok(reviewStatusPriority("submitted") > reviewStatusPriority("draft"))
  assert.ok(reviewStatusPriority("draft") > reviewStatusPriority(null))
})

test("pickCanonicalReview prefers the most advanced status over newer rows", () => {
  const picked = pickCanonicalReview([
    { id: "new-draft", status: "draft", created_at: "2026-09-02T00:00:00Z" },
    { id: "old-completed", status: "completed", created_at: "2026-08-01T00:00:00Z" },
  ])
  assert.equal(picked.id, "old-completed")
})

test("pickCanonicalReview breaks a status tie with written feedback, then recency", () => {
  const withFeedback = pickCanonicalReview([
    { id: "newer-empty", status: "submitted", created_at: "2026-09-02T00:00:00Z" },
    { id: "older-written", status: "submitted", created_at: "2026-09-01T00:00:00Z", strengths: "Clear reports" },
  ])
  assert.equal(withFeedback.id, "older-written")

  const newest = pickCanonicalReview([
    { id: "a", status: "submitted", created_at: "2026-09-01T00:00:00Z" },
    { id: "b", status: "submitted", created_at: "2026-09-03T00:00:00Z" },
  ])
  assert.equal(newest.id, "b")
})
