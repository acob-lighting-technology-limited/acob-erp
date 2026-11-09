import assert from "node:assert/strict"
import test from "node:test"
import { appealExpiryDate, isAppealExpired } from "@/lib/hr/appeal-expiry"

test("an appeal expires at the end of the month after the appealed day", () => {
  assert.equal(appealExpiryDate("2026-11-10", "lateness_with_permission"), "2026-12-31")
  assert.equal(appealExpiryDate("2026-10-31", "absent_with_permission"), "2026-11-30")
  assert.equal(appealExpiryDate("2026-12-15", "absent_with_permission"), "2027-01-31")
  assert.equal(appealExpiryDate("2027-01-20", "incomplete_with_permission"), "2027-02-28")
  assert.equal(appealExpiryDate("2028-01-20", "incomplete_with_permission"), "2028-02-29") // leap year
})

test("out-of-station appeals keep six months after the month of the day", () => {
  assert.equal(appealExpiryDate("2026-11-10", "out_of_station"), "2027-05-31")
})

test("expired only once the deadline day is over", () => {
  assert.equal(isAppealExpired("2026-11-10", "absent_with_permission", "2026-12-31"), false)
  assert.equal(isAppealExpired("2026-11-10", "absent_with_permission", "2027-01-01"), true)
  // The June to September backlog is already past its deadline.
  assert.equal(isAppealExpired("2026-08-12", "absent_with_permission", "2026-11-09"), true)
  assert.equal(isAppealExpired("2026-10-12", "absent_with_permission", "2026-11-09"), false)
})
