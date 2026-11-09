import assert from "node:assert/strict"
import test from "node:test"
import {
  adminRoutesForPages,
  consolePageKeys,
  deptRelativePath,
  firstAllowedDeptPath,
  isDeptApiAllowed,
  isDeptPathAllowed,
} from "@/lib/dept/delegated-pages"

test("the path after the department id", () => {
  assert.equal(deptRelativePath("/dept/abc/hr/attendance"), "/hr/attendance")
  assert.equal(deptRelativePath("/dept/abc"), "")
  assert.equal(deptRelativePath("/api/dept/abc/tasks/"), "/tasks")
})

test("a delegate reaches only the delegated pages, and what is beneath them", () => {
  const pages = ["hr.attendance", "tasks"]
  assert.equal(isDeptPathAllowed(pages, "/hr/attendance"), true)
  assert.equal(isDeptPathAllowed(pages, "/hr/attendance/records"), true)
  assert.equal(isDeptPathAllowed(pages, "/tasks"), true)
  assert.equal(isDeptPathAllowed(pages, "/hr/employees"), false)
  assert.equal(isDeptPathAllowed(pages, "/hr/attendance-fake"), false)
})

test("the console root and unknown paths are closed to a delegate", () => {
  assert.equal(isDeptPathAllowed(["tasks"], ""), false)
  assert.equal(isDeptPathAllowed(["tasks"], "/something-new"), false)
})

test("a delegate lands on the first delegated page in sidebar order", () => {
  assert.equal(firstAllowedDeptPath(["tasks", "hr.leave"]), "/hr/leave")
  assert.equal(firstAllowedDeptPath([]), null)
})

test("an API call is judged by its own page, else by the page it came from", () => {
  const pages = ["hr.attendance"]
  // A call that belongs to another page is refused even with an allowed Referer.
  assert.equal(isDeptApiAllowed(pages, "/api/admin/hr/employees", "/dept/abc/hr/attendance"), false)
  // A call that belongs to the delegated page is allowed.
  assert.equal(isDeptApiAllowed(pages, "/api/admin/hr/attendance/records", null), true)
  // An unclassified call follows its Referer.
  assert.equal(isDeptApiAllowed(pages, "/api/something", "/dept/abc/hr/attendance"), true)
  assert.equal(isDeptApiAllowed(pages, "/api/something", "/dept/abc/tasks"), false)
  assert.equal(isDeptApiAllowed(pages, "/api/something", null), false)
})

test("ticking a console page also hands over its admin twin, but only what the lead can pass on", () => {
  const delegable = ["hr.attendance", "hr.lunch"]
  assert.deepEqual(adminRoutesForPages(["hr.attendance", "tasks"], delegable), ["hr.attendance"])
  // Employees has an admin twin too, but this lead cannot pass it on.
  assert.deepEqual(adminRoutesForPages(["hr.employees"], delegable), [])
})

test("an admin-only page hands over its own route, and only to a lead who can pass it on", () => {
  assert.deepEqual(adminRoutesForPages(["hr.lunch"], ["hr.lunch"]), ["hr.lunch"])
  assert.deepEqual(adminRoutesForPages(["hr.lunch"], ["hr.attendance"]), [])
})

test("only console pages count as console pages", () => {
  assert.deepEqual(consolePageKeys(["hr.lunch", "tasks", "hr.leave"]), ["tasks", "hr.leave"])
})
