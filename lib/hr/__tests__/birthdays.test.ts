import { test } from "node:test"
import assert from "node:assert/strict"
import { birthdayRangeDays, birthdayWeekOf, isBirthdayInRange } from "../birthdays"
import { parseBirthdayReminderConfig } from "../birthday-reminder"

test("the birthday week runs Monday to Sunday around any day", () => {
  for (const day of ["2026-11-02", "2026-11-05", "2026-11-08"]) {
    const week = birthdayWeekOf(day)
    assert.equal(week.monday, "2026-11-02", day)
    assert.deepEqual(
      week.days.map((d) => d.mmdd),
      ["11-02", "11-03", "11-04", "11-05", "11-06", "11-07", "11-08"]
    )
  }
  const week = birthdayWeekOf("2026-11-02")
  assert.equal(week.days[0].label, "Mon 2 Nov")
  assert.equal(week.label, "2 Nov – 8 Nov")
})

test("a week across New Year keeps both years' days", () => {
  const week = birthdayWeekOf("2027-01-01")
  assert.equal(week.monday, "2026-12-28")
  assert.deepEqual(
    week.days.map((d) => d.mmdd),
    ["12-28", "12-29", "12-30", "12-31", "01-01", "01-02", "01-03"]
  )
  assert.equal(isBirthdayInRange("01-02", "12-28", "01-03"), true)
  assert.equal(isBirthdayInRange("01-04", "12-28", "01-03"), false)
})

test("a missing or malformed reminder setting reads as switched off", () => {
  assert.deepEqual(parseBirthdayReminderConfig(null), { enabled: false, recipientUserIds: [], externalEmails: [] })
  assert.deepEqual(parseBirthdayReminderConfig({ enabled: "yes", recipientUserIds: [1, "a"], lastSentWeek: 3 }), {
    enabled: false,
    recipientUserIds: ["a"],
    externalEmails: [],
  })
})

test("a birthday range counts its days inclusively, across New Year too", () => {
  assert.equal(birthdayRangeDays("11-02", "11-08"), 7)
  assert.equal(birthdayRangeDays("12-28", "01-03"), 7)
  assert.equal(birthdayRangeDays("11-02", "11-02"), 1)
  assert.equal(birthdayRangeDays("01-01", "12-31"), 366)
})
