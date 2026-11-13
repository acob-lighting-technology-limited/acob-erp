import { test } from "node:test"
import assert from "node:assert/strict"
import { daysInRange, isIsoDay, shiftIsoDay, summariseUsage } from "../network-usage-report"

const GB = 1024 ** 3

test("adds a person's devices and days together, and puts the heaviest first", () => {
  const report = summariseUsage(
    [
      { day: "2026-11-10", username: "a@x.com", mac_address: "AA:01", bytes_in: GB, bytes_out: 4 * GB },
      { day: "2026-11-10", username: "A@x.com", mac_address: "AA:02", bytes_in: 0, bytes_out: GB },
      { day: "2026-11-11", username: "a@x.com", mac_address: "AA:01", bytes_in: GB, bytes_out: 2 * GB },
      { day: "2026-11-10", username: "tv3", mac_address: "BB:01", bytes_in: 0, bytes_out: 20 * GB },
    ],
    [],
    new Map([["a@x.com", "Ada Eze"]])
  )

  assert.deepEqual(
    report.users.map((u) => u.username),
    ["tv3", "a@x.com"]
  )
  const ada = report.users[1]
  assert.equal(ada.staffName, "Ada Eze")
  assert.equal(ada.devices, 2)
  assert.equal(ada.daysActive, 2)
  assert.equal(ada.downloadBytes, 7 * GB)
  assert.equal(ada.uploadBytes, 2 * GB)
  assert.equal(ada.totalBytes, 9 * GB)
  assert.equal(report.users[0].staffName, null)
})

test("daily totals line the counted logins up against the office line, newest first", () => {
  const report = summariseUsage(
    [
      { day: "2026-11-10", username: "a", mac_address: "", bytes_in: GB, bytes_out: 10 * GB },
      { day: "2026-11-11", username: "a", mac_address: "", bytes_in: GB, bytes_out: 20 * GB },
    ],
    [
      { day: "2026-11-10", rx_bytes: 12 * GB, tx_bytes: 2 * GB },
      { day: "2026-11-12", rx_bytes: 3 * GB, tx_bytes: GB },
    ]
  )
  assert.deepEqual(
    report.days.map((d) => d.day),
    ["2026-11-12", "2026-11-11", "2026-11-10"]
  )
  assert.equal(report.days[2].officeDownloadBytes, 12 * GB)
  assert.equal(report.days[1].officeDownloadBytes, 0)
  assert.equal(report.totals.downloadBytes, 30 * GB)
  assert.equal(report.totals.officeDownloadBytes, 15 * GB)
  assert.equal(report.users[0].devices, 1)
})

test("empty input gives empty totals", () => {
  const report = summariseUsage([], [])
  assert.deepEqual(report.users, [])
  assert.deepEqual(report.days, [])
  assert.equal(report.totals.downloadBytes, 0)
})

test("day helpers", () => {
  assert.equal(isIsoDay("2026-11-12"), true)
  assert.equal(isIsoDay("2026-02-30"), false)
  assert.equal(isIsoDay("12-11-2026"), false)
  assert.equal(isIsoDay(null), false)
  assert.equal(shiftIsoDay("2026-11-01", -1), "2026-10-31")
  assert.equal(shiftIsoDay("2026-12-31", 1), "2027-01-01")
  assert.equal(daysInRange("2026-11-06", "2026-11-12"), 7)
  assert.equal(daysInRange("2026-11-12", "2026-11-12"), 1)
})
