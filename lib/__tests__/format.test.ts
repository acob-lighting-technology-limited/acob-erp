import assert from "node:assert/strict"
import test from "node:test"
import { formatCurrency, formatDate, formatPercent, humanize, initials, personName } from "@/lib/format"

test("formatDate renders WAT day month year and handles empty input", () => {
  assert.equal(formatDate("2026-05-25T08:30:00Z"), "25 May 2026")
  // 23:30 UTC on the 24th is already the 25th in Lagos (UTC+1)
  assert.equal(formatDate("2026-05-24T23:30:00Z"), "25 May 2026")
  assert.equal(formatDate(null), "—")
  assert.equal(formatDate("not a date", "n/a"), "n/a")
})

test("formatCurrency formats Naira by default", () => {
  assert.equal(formatCurrency(1250000), "₦1,250,000.00")
  assert.equal(formatCurrency(1250000, { whole: true }), "₦1,250,000")
  assert.equal(formatCurrency(1250000, { compact: true }), "₦1.3M")
  assert.equal(formatCurrency(null), "—")
  assert.equal(formatCurrency("12.5"), "₦12.50")
})

test("formatPercent accepts ratios and percentages", () => {
  assert.equal(formatPercent(0.873), "87%")
  assert.equal(formatPercent(87.3, { ratio: false, decimals: 1 }), "87.3%")
})

test("personName and initials fall back sensibly", () => {
  assert.equal(personName({ first_name: "Ada", last_name: "Obi" }), "Ada Obi")
  assert.equal(personName({ company_email: "ada.obi@acoblighting.com" }), "ada.obi")
  assert.equal(initials({ full_name: "Ada Chioma Obi" }), "AO")
  assert.equal(initials(null), "?")
})

test("humanize turns codes into labels", () => {
  assert.equal(humanize("in_progress"), "In progress")
  assert.equal(humanize(""), "—")
})
