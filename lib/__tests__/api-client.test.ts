import test from "node:test"
import assert from "node:assert/strict"
import { apiFetch, readDeptContext } from "../api-client"

type Captured = { input: unknown; init?: RequestInit }

function install(pathname: string, cookie: string) {
  const calls: Captured[] = []
  const g = globalThis as unknown as Record<string, unknown>
  const saved = { fetch: g.fetch, window: g.window, document: g.document }
  g.window = { location: { pathname } }
  g.document = { cookie }
  g.fetch = async (input: unknown, init?: RequestInit) => {
    calls.push({ input, init })
    return new Response("{}")
  }
  return {
    calls,
    restore() {
      g.fetch = saved.fetch
      g.window = saved.window
      g.document = saved.document
    },
  }
}

test("inside a dept console every request carries x-dept-context", async () => {
  const env = install("/dept/abc-123/hr/leave", "")
  try {
    await apiFetch("/api/hr/leave")
    const headers = new Headers(env.calls[0].init?.headers)
    assert.equal(headers.get("x-dept-context"), "abc-123")
    assert.equal(headers.get("x-csrf-token"), null)
  } finally {
    env.restore()
  }
})

test("mutating requests carry the csrf token", async () => {
  const env = install("/admin/hr/leave", "csrf_token=tok%20en; other=1")
  try {
    await apiFetch("/api/hr/leave", { method: "POST" })
    const headers = new Headers(env.calls[0].init?.headers)
    assert.equal(headers.get("x-csrf-token"), "tok en")
    assert.equal(headers.get("x-dept-context"), null)
  } finally {
    env.restore()
  }
})

test("a plain GET outside the console keeps its options and gains only a timeout", async () => {
  const env = install("/admin/hr/leave", "csrf_token=abc")
  try {
    await apiFetch("/api/hr/leave", { cache: "no-store" })
    const init = env.calls[0].init
    assert.equal(init?.cache, "no-store")
    const headers = new Headers(init?.headers)
    assert.equal(headers.get("x-csrf-token"), null)
    assert.equal(headers.get("x-dept-context"), null)
    assert.ok(init?.signal, "a default timeout signal is attached")
  } finally {
    env.restore()
  }
})

test("a caller's own signal and FormData uploads are not given the default timeout", async () => {
  const env = install("/admin/hr/leave", "")
  try {
    const own = new AbortController()
    await apiFetch("/api/x", { signal: own.signal })
    assert.equal(env.calls[0].init?.signal, own.signal)
    await apiFetch("/api/upload", { method: "POST", body: new FormData() })
    assert.equal(env.calls[1].init?.signal, undefined)
  } finally {
    env.restore()
  }
})

test("a 401 sends the user to log in and back, once", async () => {
  const env = install("/hr/leave", "")
  const g = globalThis as unknown as {
    window: { location: { pathname: string; search: string; assign: (u: string) => void } }
  }
  const assigned: string[] = []
  g.window.location = { pathname: "/hr/leave", search: "?tab=mine", assign: (u: string) => assigned.push(u) }
  ;(globalThis as unknown as { fetch: unknown }).fetch = async () => new Response("{}", { status: 401 })
  try {
    await apiFetch("/api/hr/leave")
    await apiFetch("/api/hr/leave")
    assert.deepEqual(assigned, ["/auth/login?next=%2Fhr%2Fleave%3Ftab%3Dmine"])
  } finally {
    env.restore()
  }
})

test("readDeptContext is null outside the console and safe without a window", () => {
  const env = install("/admin/x", "")
  try {
    assert.equal(readDeptContext(), null)
  } finally {
    env.restore()
  }
  const g = globalThis as unknown as Record<string, unknown>
  const savedWindow = g.window
  delete g.window
  try {
    assert.equal(readDeptContext(), null)
  } finally {
    g.window = savedWindow
  }
})
