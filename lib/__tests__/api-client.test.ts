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

test("a plain GET outside the console passes through untouched", async () => {
  const env = install("/admin/hr/leave", "csrf_token=abc")
  try {
    await apiFetch("/api/hr/leave", { cache: "no-store" })
    assert.deepEqual(env.calls[0].init, { cache: "no-store" })
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
