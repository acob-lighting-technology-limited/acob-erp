import test from "node:test"
import assert from "node:assert/strict"
import { orderRoster, rosterPhase } from "@/lib/hr/roster-order"

// WAT is UTC+1, so 10:00 WAT is 09:00Z.
const at = (iso: string) => new Date(iso)

test("during the working day the roster shows arrivals", () => {
  assert.equal(
    rosterPhase({ rosterDate: "2026-10-01", now: at("2026-10-01T09:00:00Z"), closeTime: "17:00" }),
    "arrivals"
  )
})

test("from closing time it shows departures", () => {
  assert.equal(
    rosterPhase({ rosterDate: "2026-10-01", now: at("2026-10-01T16:00:00Z"), closeTime: "17:00" }),
    "departures"
  )
})

test("an early closure moves the switch earlier", () => {
  // 15:30 WAT, with closing brought forward to 15:00.
  assert.equal(
    rosterPhase({ rosterDate: "2026-10-01", now: at("2026-10-01T14:30:00Z"), closeTime: "15:00:00" }),
    "departures"
  )
  assert.equal(
    rosterPhase({ rosterDate: "2026-10-01", now: at("2026-10-01T14:30:00Z"), closeTime: "17:00" }),
    "arrivals"
  )
})

test("until 04:00 the night still belongs to the previous day", () => {
  // 02:00 WAT on 2 Oct.
  const now = at("2026-10-02T01:00:00Z")
  assert.equal(rosterPhase({ rosterDate: "2026-10-01", now, closeTime: "17:00" }), "departures")
  assert.equal(rosterPhase({ rosterDate: "2026-10-02", now, closeTime: "17:00" }), "arrivals")
})

test("a past day has no live phase", () => {
  assert.equal(rosterPhase({ rosterDate: "2026-09-28", now: at("2026-10-01T09:00:00Z"), closeTime: "17:00" }), null)
})

const rows = [
  { user_name: "Ada", clock_in: "08:10:00", clock_out: null },
  { user_name: "Bola", clock_in: null, clock_out: null },
  { user_name: "Chidi", clock_in: "08:45:00", clock_out: "17:20:00" },
  { user_name: "Ayo", clock_in: null, clock_out: null },
  { user_name: "Dayo", clock_in: "07:55:00", clock_out: "17:05:00" },
]

test("arrivals: newest clock-in first, not-in-yet at the bottom alphabetically", () => {
  assert.deepEqual(
    orderRoster(rows, "arrivals").map((r) => r.user_name),
    ["Chidi", "Ada", "Dayo", "Ayo", "Bola"]
  )
})

test("departures: newest clock-out first, still-in at the bottom alphabetically", () => {
  assert.deepEqual(
    orderRoster(rows, "departures").map((r) => r.user_name),
    ["Chidi", "Dayo", "Ada", "Ayo", "Bola"]
  )
})

test("a past day is alphabetical", () => {
  assert.deepEqual(
    orderRoster(rows, null).map((r) => r.user_name),
    ["Ada", "Ayo", "Bola", "Chidi", "Dayo"]
  )
})
