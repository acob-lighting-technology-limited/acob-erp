import test from "node:test"
import assert from "node:assert/strict"
import { monitoredFetch, type RequestFailure } from "../fetch-monitor"
import { redact, safeContext, safePath } from "../sanitize"
import { logWindow, platformQuery } from "../platform"
import { groupErrors } from "../group"

test("grouping keeps affected users and resolution states separate and preserves event references", () => {
  const row = {
    id: "one",
    source: "http.error",
    route: "/tasks",
    message: "failed",
    user_name: "User A",
    resolved: false,
  }
  const grouped = groupErrors([
    row,
    { ...row, id: "two" },
    { ...row, id: "three", user_name: "User B" },
    { ...row, id: "four", resolved: true },
  ])
  assert.equal(grouped.length, 3)
  assert.equal(grouped[0].id, "one")
  assert.equal(grouped[0].occurrences, 2)
  assert.deepEqual(grouped[0].eventIds, ["one", "two"])
})

test("failed requests preserve the response stream, method and request reference", async () => {
  const events: RequestFailure[] = []
  const response = new Response('{"error":"failed"}', { status: 500, headers: { "x-request-id": "ref-123" } })
  const observed = monitoredFetch(
    async () => response,
    "https://app.test",
    "https://db.supabase.co",
    (event) => events.push(event)
  )
  const result = await observed(new Request("https://app.test/api/save?token=secret", { method: "POST" }))
  assert.equal(result, response)
  assert.equal(await result.text(), '{"error":"failed"}')
  assert.equal(events[0].context.method, "POST")
  assert.equal(events[0].context.requestId, "ref-123")
  assert.equal(events[0].context.endpoint, "/api/save")
  assert.ok(!JSON.stringify(events).includes("secret"))
})

test("Supabase returned errors are reported without throwing or consuming the body", async () => {
  const events: RequestFailure[] = []
  const observed = monitoredFetch(
    async () => new Response("denied", { status: 403 }),
    "https://app.test",
    "https://db.supabase.co",
    (event) => events.push(event)
  )
  assert.equal(await (await observed("https://db.supabase.co/rest/v1/profiles")).text(), "denied")
  assert.equal(events[0].source, "supabase.request")
})

test("telemetry, audit, external requests and intentional cancellations cannot cause reporting loops", async () => {
  const events: RequestFailure[] = []
  const observed = monitoredFetch(
    async () => new Response("failed", { status: 500 }),
    "https://app.test",
    "https://db.supabase.co",
    (event) => events.push(event)
  )
  for (const url of [
    "/api/telemetry/errors",
    "https://db.supabase.co/rest/v1/audit_logs",
    "https://elsewhere.test/api/send",
  ])
    await observed(url)
  const aborted = new DOMException("cancelled", "AbortError")
  const abortFetch = monitoredFetch(
    async () => {
      throw aborted
    },
    "https://app.test",
    undefined,
    (event) => events.push(event)
  )
  await assert.rejects(abortFetch("/api/save"), (error) => error === aborted)
  assert.equal(events.length, 0)
})

test("network errors retain original rejection and a reporter failure cannot break requests", async () => {
  const networkError = new Error("offline")
  const events: RequestFailure[] = []
  const observed = monitoredFetch(
    async () => {
      throw networkError
    },
    "https://app.test",
    undefined,
    (event) => events.push(event)
  )
  await assert.rejects(observed("/api/save"), (error) => error === networkError)
  assert.equal(events[0].context.status, 0)
  const response = new Response("failed", { status: 500 })
  const badReporter = monitoredFetch(
    async () => response,
    "https://app.test",
    undefined,
    () => {
      throw new Error("reporting unavailable")
    }
  )
  assert.equal(await badReporter("/api/save"), response)
})

test("secrets, URL queries and arbitrary context fields are removed", () => {
  assert.equal(safePath("https://user:password@app.test/api/save?token=x#secret"), "/api/save")
  const value = redact(
    "password=secret Bearer abc.def.ghi https://app.test/reset?token=private Failing row contains (personal data)"
  )
  assert.ok(!value.includes("secret"))
  assert.ok(!value.includes("abc.def.ghi"))
  assert.ok(!value.includes("private"))
  assert.ok(!value.includes("personal data"))
  assert.deepEqual(
    safeContext({ method: "POST", password: "secret", body: { name: "private" }, endpoint: "/api/save?key=x" }),
    { method: "POST", endpoint: "/api/save" }
  )
})

test("collector windows overlap for late arrivals and remain within API retention bounds", () => {
  const now = new Date("2026-10-06T12:00:00Z")
  const first = logWindow(undefined, now)
  assert.equal(first.end, "2026-10-06T11:59:00.000Z")
  assert.equal(first.start, "2026-10-06T11:29:00.000Z")
  const recovery = logWindow("2026-10-01T12:00:00Z", now)
  assert.equal(Date.parse(recovery.end) - Date.parse(recovery.start), 23 * 60 * 60 * 1000)
  const future = logWindow("2027-01-01T12:00:00Z", now)
  assert.equal(future.start, future.end)
  assert.match(platformQuery({ timestamp: "2026-10-06T11:00:00", id: "event-1" }), /toString\(id\) > 'event-1'/)
  assert.throws(() => platformQuery({ timestamp: "garbage", id: "event-1" }))
  assert.ok(platformQuery({ timestamp: "2026-10-06T11:00:00.123456", id: "event-1" }).includes(".123456"))
})
