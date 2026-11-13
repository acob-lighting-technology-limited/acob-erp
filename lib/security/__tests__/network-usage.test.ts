import { test } from "node:test"
import assert from "node:assert/strict"
import {
  counterDelta,
  NetworkUsageBatchSchema,
  parseRouterUptime,
  planUsageUpdate,
  sessionDelta,
  sessionStateKey,
  stateKeysFor,
  type NetworkUsageBatch,
  type UsageState,
} from "../network-usage"

const MB = 1024 * 1024
const T0 = Date.parse("2026-11-12T17:00:00+01:00")
const FIVE_MIN = 5 * 60 * 1000

const state = (bytesIn: number, bytesOut: number, uptimeSeconds: number | null, seenAtMs = T0): UsageState => ({
  bytesIn,
  bytesOut,
  uptimeSeconds,
  seenAtMs,
})

test("parses every uptime format RouterOS prints", () => {
  assert.equal(parseRouterUptime("01:43:45"), 6225)
  assert.equal(parseRouterUptime("17:09:28"), 61_768)
  assert.equal(parseRouterUptime("3d17:09:28"), 3 * 86_400 + 61_768)
  assert.equal(parseRouterUptime("2h13m05s"), 7985)
  assert.equal(parseRouterUptime("1w2d3h4m5s"), 604_800 + 2 * 86_400 + 3 * 3600 + 4 * 60 + 5)
  assert.equal(parseRouterUptime(""), null)
  assert.equal(parseRouterUptime(null), null)
  assert.equal(parseRouterUptime("soon"), null)
})

test("an ongoing session counts only what it used since the last report", () => {
  const delta = sessionDelta(
    state(10 * MB, 100 * MB, 3600),
    { bytesIn: 12 * MB, bytesOut: 130 * MB, uptimeSeconds: 3900 },
    T0 + FIVE_MIN
  )
  assert.deepEqual(delta, { bytesIn: 2 * MB, bytesOut: 30 * MB, restarted: false })
})

test("a retried push adds nothing", () => {
  const delta = sessionDelta(
    state(12 * MB, 130 * MB, 3900, T0 + FIVE_MIN),
    { bytesIn: 12 * MB, bytesOut: 130 * MB, uptimeSeconds: 3900 },
    T0 + FIVE_MIN + 2000
  )
  assert.deepEqual(delta, { bytesIn: 0, bytesOut: 0, restarted: false })
})

test("a session that restarted counts its whole current total", () => {
  const lowerBytes = sessionDelta(
    state(10 * MB, 500 * MB, 7200),
    { bytesIn: MB, bytesOut: 20 * MB, uptimeSeconds: 200 },
    T0 + FIVE_MIN
  )
  assert.deepEqual(lowerBytes, { bytesIn: MB, bytesOut: 20 * MB, restarted: true })

  // Out-counted the old session before the next report: only the uptime shows it restarted.
  const biggerButNew = sessionDelta(
    state(MB, 5 * MB, 7200),
    { bytesIn: 3 * MB, bytesOut: 9 * MB, uptimeSeconds: 250 },
    T0 + FIVE_MIN
  )
  assert.equal(biggerButNew.restarted, true)
  assert.equal(biggerButNew.bytesOut, 9 * MB)
})

test("a session that started after a long gap is new even if its uptime did not drop", () => {
  const delta = sessionDelta(
    state(MB, 5 * MB, 100),
    { bytesIn: 2 * MB, bytesOut: 9 * MB, uptimeSeconds: 3000 },
    T0 + 3 * 3600 * 1000
  )
  assert.equal(delta.restarted, true)
  assert.equal(delta.bytesOut, 9 * MB)
})

test("a session first seen mid-way is baselined, a brand new one is counted", () => {
  const midway = sessionDelta(undefined, { bytesIn: MB, bytesOut: 900 * MB, uptimeSeconds: 30_000 }, T0)
  assert.deepEqual(midway, { bytesIn: 0, bytesOut: 0, restarted: false })

  const fresh = sessionDelta(undefined, { bytesIn: MB, bytesOut: 4 * MB, uptimeSeconds: 120 }, T0)
  assert.deepEqual(fresh, { bytesIn: MB, bytesOut: 4 * MB, restarted: true })

  const unknownUptime = sessionDelta(undefined, { bytesIn: MB, bytesOut: 4 * MB, uptimeSeconds: null }, T0)
  assert.deepEqual(unknownUptime, { bytesIn: 0, bytesOut: 0, restarted: false })
})

test("interface counters baseline first, then reset with the router", () => {
  assert.deepEqual(counterDelta(undefined, { bytesIn: 50, bytesOut: 5 }), { bytesIn: 0, bytesOut: 0 })
  assert.deepEqual(counterDelta(state(50, 5, null), { bytesIn: 80, bytesOut: 9 }), { bytesIn: 30, bytesOut: 4 })
  assert.deepEqual(counterDelta(state(500, 50, null), { bytesIn: 8, bytesOut: 1 }), { bytesIn: 8, bytesOut: 1 })
})

const batch = (overrides: Partial<NetworkUsageBatch> = {}): NetworkUsageBatch => ({
  router: "ACOB-router",
  sent_at: "2026-11-12T17:05:00+01:00",
  router_uptime: "17:09:28",
  wan: { interface: "ether1", rx_bytes: 2000, tx_bytes: 300 },
  sessions: [
    {
      user: "A.Edward@org.acoblighting.com",
      mac_address: "aa:bb:cc:dd:ee:01",
      address: "10.20.50.90",
      uptime: "09:19:36",
      bytes_in: 12 * MB,
      bytes_out: 130 * MB,
    },
    {
      user: "a.edward@org.acoblighting.com",
      mac_address: "AA:BB:CC:DD:EE:02",
      address: "10.20.50.91",
      uptime: "00:30:00",
      bytes_in: MB,
      bytes_out: 8 * MB,
    },
  ],
  ...overrides,
})

test("plans one daily row per login and device, and lowercases the login", () => {
  const input = batch()
  const first = input.sessions[0]
  const states = new Map<string, UsageState>([
    [sessionStateKey("ACOB-router", first), state(10 * MB, 100 * MB, 33_276)],
    ["ACOB-router|wan|ether1", state(1500, 250, null)],
  ])
  const plan = planUsageUpdate(input, states, T0 + FIVE_MIN)

  assert.equal(plan.daily.length, 2)
  const byMac = Object.fromEntries(plan.daily.map((row) => [row.mac_address, row]))
  assert.equal(byMac["AA:BB:CC:DD:EE:01"].username, "a.edward@org.acoblighting.com")
  assert.equal(byMac["AA:BB:CC:DD:EE:01"].bytes_out, 30 * MB)
  assert.equal(byMac["AA:BB:CC:DD:EE:01"].bytes_in, 2 * MB)
  // Second device was not seen before and has been up 30 minutes: baseline only.
  assert.equal(byMac["AA:BB:CC:DD:EE:02"].bytes_out, 0)
  assert.deepEqual(plan.wan, { interface: "ether1", rx_bytes: 500, tx_bytes: 50 })
  assert.equal(plan.state.length, 2)
  assert.equal(plan.wanState?.bytes_in, 2000)
})

test("two sessions of one device in the same report are summed into one row", () => {
  const input = batch({
    sessions: [
      {
        user: "tv",
        mac_address: "EA:31:82:AE:1A:12",
        address: "10.20.50.61",
        uptime: "00:02:00",
        bytes_in: 5,
        bytes_out: 10,
      },
      {
        user: "tv",
        mac_address: "EA:31:82:AE:1A:12",
        address: "10.20.50.62",
        uptime: "00:03:00",
        bytes_in: 7,
        bytes_out: 20,
      },
    ],
  })
  const plan = planUsageUpdate(input, new Map(), T0)
  assert.equal(plan.daily.length, 1)
  assert.deepEqual([plan.daily[0].bytes_in, plan.daily[0].bytes_out], [12, 30])
  assert.equal(plan.state.length, 2)
})

test("state keys cover every session and the WAN counter", () => {
  const keys = stateKeysFor(batch())
  assert.equal(keys.length, 3)
  assert.ok(keys.includes("ACOB-router|wan|ether1"))
})

test("accepts the router's real payload and rejects a bad one", () => {
  const ok = NetworkUsageBatchSchema.safeParse({
    router: "ACOB-router",
    sent_at: "2026-11-12T17:17:57+01:00",
    router_uptime: "17:09:28",
    wan: { interface: "ether1", rx_bytes: 50_137_078_749, tx_bytes: 4_584_024_251 },
    sessions: [
      {
        user: "tv2",
        mac_address: "EA:31:82:AE:1A:12",
        address: "10.20.50.61",
        uptime: "01:43:45",
        bytes_in: 3_404_428,
        bytes_out: 2_554_704,
      },
    ],
  })
  assert.equal(ok.success, true)

  assert.equal(NetworkUsageBatchSchema.safeParse({ router: "r", sent_at: "yesterday", sessions: [] }).success, false)
  assert.equal(
    NetworkUsageBatchSchema.safeParse({
      router: "r",
      sent_at: "2026-11-12T17:17:57+01:00",
      sessions: [{ user: "x", bytes_in: "1.2GiB", bytes_out: 1 }],
    }).success,
    false
  )
})

test("an empty session list is valid, so the office line is still recorded", () => {
  const parsed = NetworkUsageBatchSchema.parse({
    router: "ACOB-router",
    sent_at: "2026-11-12T03:00:00+01:00",
    wan: { interface: "ether1", rx_bytes: 1, tx_bytes: 1 },
    sessions: [],
  })
  const plan = planUsageUpdate(parsed, new Map(), T0)
  assert.equal(plan.daily.length, 0)
  assert.equal(plan.wanState?.key, "ACOB-router|wan|ether1")
})
