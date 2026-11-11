import test from "node:test"
import assert from "node:assert/strict"
import { LEAVE_REVIEWS_PATH } from "@/lib/hr/leave-links"

test("the approver link opens the Pending Reviews tab of the leave page", () => {
  const url = new URL(LEAVE_REVIEWS_PATH, "https://example.test")
  assert.equal(url.pathname, "/hr/leave")
  assert.equal(url.searchParams.get("tab"), "reviews")
})
