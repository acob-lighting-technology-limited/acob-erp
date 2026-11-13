import { test } from "node:test"
import assert from "node:assert/strict"
import { acceptanceRespondBy, acceptanceStep } from "../acceptance"

// 2026-11-09 is a Monday.
test("nothing happens on the day it was assigned, or the first working day after", () => {
  assert.equal(acceptanceStep("2026-11-09", "2026-11-09", false), "wait")
  assert.equal(acceptanceStep("2026-11-09", "2026-11-10", false), "wait")
})

test("one reminder after a full working day, then not again", () => {
  assert.equal(acceptanceStep("2026-11-09", "2026-11-11", false), "remind")
  assert.equal(acceptanceStep("2026-11-09", "2026-11-11", true), "wait")
})

test("counted as accepted after three full working days", () => {
  assert.equal(acceptanceStep("2026-11-09", "2026-11-12", true), "wait")
  assert.equal(acceptanceStep("2026-11-09", "2026-11-13", true), "auto_accept")
})

test("weekends do not count: assigned Thursday, still waiting on Monday", () => {
  assert.equal(acceptanceStep("2026-11-12", "2026-11-16", true), "wait")
  assert.equal(acceptanceStep("2026-11-12", "2026-11-17", true), "wait")
  assert.equal(acceptanceStep("2026-11-12", "2026-11-18", true), "auto_accept")
})

test("a holiday or the person's leave pushes it back", () => {
  const away = new Set(["2026-11-10", "2026-11-11"])
  assert.equal(acceptanceStep("2026-11-09", "2026-11-13", true, away), "wait")
  assert.equal(acceptanceStep("2026-11-09", "2026-11-17", true, away), "auto_accept")
})

test("no reminder is sent on a day the person is not working", () => {
  // Saturday 14 Nov: three working days have not elapsed since Thursday 12 Nov, but it is a weekend.
  assert.equal(acceptanceStep("2026-11-09", "2026-11-14", false), "auto_accept")
  assert.equal(acceptanceStep("2026-11-12", "2026-11-14", false), "wait")
})

test("respond-by is the third working day after it was entered", () => {
  assert.equal(acceptanceRespondBy("2026-11-09"), "2026-11-12")
  assert.equal(acceptanceRespondBy("2026-11-12"), "2026-11-17")
  assert.equal(acceptanceRespondBy("2026-11-09", new Set(["2026-11-10"])), "2026-11-13")
})
