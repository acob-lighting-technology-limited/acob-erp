import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { DEPT_MIRRORED_PATHS, isMirroredInDept, shellBackHref, shellBaseFromPathname, shellHref } from "../shell-links"

function deptPagesOnDisk(): string[] {
  const root = path.join("app", "dept", "[dept_id]")
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "page.tsx") {
        const segments = path
          .relative(root, path.dirname(full))
          .split(path.sep)
          .filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@") && s !== "_components")
        found.add(segments.length ? `/${segments.join("/")}` : "")
      }
    }
  }
  walk(root)
  return [...found].sort()
}

test("the mirrored-path list matches the pages in app/dept (update shell-links.ts if this fails)", () => {
  assert.deepEqual([...DEPT_MIRRORED_PATHS].sort(), deptPagesOnDisk())
})

test("the shell is read from the pathname", () => {
  assert.equal(shellBaseFromPathname("/dept/abc-1/hr/leave"), "/dept/abc-1")
  assert.equal(shellBaseFromPathname("/dept/abc-1"), "/dept/abc-1")
  assert.equal(shellBaseFromPathname("/admin/hr/leave"), "/admin")
  assert.equal(shellBaseFromPathname("/profile"), "/admin")
  assert.equal(shellBaseFromPathname(null), "/admin")
  assert.equal(shellBaseFromPathname(undefined), "/admin")
})

test("in the admin shell every link is returned unchanged", () => {
  for (const href of ["/admin/tasks", "/admin/audit-logs", "/admin/reports/general-meeting?week=3", "/profile"]) {
    assert.equal(shellHref(href, "/admin"), href)
  }
})

test("in a dept console a mirrored page is rewritten and keeps its query and hash", () => {
  const base = "/dept/d1"
  assert.equal(shellHref("/admin/tasks", base), "/dept/d1/tasks")
  assert.equal(shellHref("/admin/hr/leave?tab=appeals#x", base), "/dept/d1/hr/leave?tab=appeals#x")
  assert.equal(shellHref("/admin", base), "/dept/d1")
  assert.equal(shellHref("/admin/", base), "/dept/d1/")
})

test("dynamic segments match", () => {
  assert.equal(
    shellHref("/admin/pms/reviews/cycle-9?mode=individual", "/dept/d1"),
    "/dept/d1/pms/reviews/cycle-9?mode=individual"
  )
  assert.equal(shellHref("/admin/pms/reviews/cycle-9/extra", "/dept/d1"), null)
})

test("a page the console does not have gives null, so the caller can omit the link", () => {
  for (const href of [
    "/admin/audit-logs",
    "/admin/feedback/surveys",
    "/admin/projects/p1",
    "/admin/reports/general-meeting",
    "/admin/accounts/starlink",
    "/admin/payroll",
  ]) {
    assert.equal(shellHref(href, "/dept/d1"), null, href)
  }
})

test("a link outside /admin is never rewritten", () => {
  assert.equal(shellHref("/hr/leave", "/dept/d1"), "/hr/leave")
  assert.equal(shellHref("/administrator", "/dept/d1"), "/administrator")
  assert.equal(shellHref("https://example.com/admin/x", "/dept/d1"), "https://example.com/admin/x")
})

test("isMirroredInDept ignores query, hash and trailing slash", () => {
  assert.equal(isMirroredInDept("/tasks/"), true)
  assert.equal(isMirroredInDept("/tasks?x=1"), true)
  assert.equal(isMirroredInDept("/nope"), false)
  assert.equal(isMirroredInDept(""), true)
})

test("a back link falls back to the nearest page the console has, ending at its home", () => {
  const base = "/dept/d1"
  assert.equal(shellBackHref("/admin/hr", base), "/dept/d1/hr")
  assert.equal(shellBackHref("/admin/reports/general-meeting", base), "/dept/d1/reports")
  assert.equal(shellBackHref("/admin/feedback/surveys", base), "/dept/d1/feedback")
  assert.equal(shellBackHref("/admin/audit-logs", base), "/dept/d1")
  assert.equal(shellBackHref("/admin/hr", "/admin"), "/admin/hr")
})
