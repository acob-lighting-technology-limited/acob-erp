import test from "node:test"
import assert from "node:assert/strict"
import { getSafeNextPath } from "../safe-next-path"

test("keeps same-origin paths, query and hash", () => {
  assert.equal(getSafeNextPath("/hr/leave"), "/hr/leave")
  assert.equal(getSafeNextPath("/tasks?taskId=abc&x=1#top"), "/tasks?taskId=abc&x=1#top")
  assert.equal(getSafeNextPath("/admin/hr/leave?tab=appeals"), "/admin/hr/leave?tab=appeals")
})

test("falls back when empty or missing", () => {
  assert.equal(getSafeNextPath(null), "/profile")
  assert.equal(getSafeNextPath(undefined), "/profile")
  assert.equal(getSafeNextPath(""), "/profile")
  assert.equal(getSafeNextPath("/x", "/home"), "/x")
  assert.equal(getSafeNextPath(null, "/home"), "/home")
})

test("rejects absolute and protocol-relative URLs", () => {
  for (const bad of [
    "https://evil.com",
    "http://evil.com/x",
    "//evil.com",
    "//evil.com/path",
    "evil.com",
    "javascript:alert(1)",
  ]) {
    assert.equal(getSafeNextPath(bad), "/profile", bad)
  }
})

test("rejects the backslash and whitespace tricks the URL parser normalises to //", () => {
  const bad = [
    "/\\evil.com",
    "/\\/evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "/\u0000/evil.com",
    "/ok\\..\\evil",
  ]
  for (const b of bad) assert.equal(getSafeNextPath(b), "/profile", JSON.stringify(b))
})

test("never returns anything that resolves off-origin", () => {
  const origin = "https://matrix.acoblighting.com"
  const probes = [
    "/a",
    "/\\evil.com",
    "/\t/evil.com",
    "///evil.com",
    "/%2F/evil.com",
    "/%5Cevil.com",
    "/a/../../evil.com",
    "/?next=//evil.com",
  ]
  for (const p of probes) {
    const out = getSafeNextPath(p)
    assert.equal(new URL(out, origin).origin, origin, `${JSON.stringify(p)} -> ${out}`)
  }
})

test("rejects oversized input", () => {
  assert.equal(getSafeNextPath(`/${"a".repeat(3000)}`), "/profile")
})
