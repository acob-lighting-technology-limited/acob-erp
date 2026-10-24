import assert from "node:assert/strict"
import test from "node:test"
import {
  getWeeklyTaskWindow,
  summarizeWeeklyTasks,
  type SummaryPersonRow,
  type SummaryTaskRow,
} from "@/lib/reports/weekly-task-summary"

// Anchor Jan 12 2026 (a Monday): week 30's meeting is Mon 3 Aug, so its report
// covers Mon 27 Jul — Sun 2 Aug.
const window = getWeeklyTaskWindow(30, 2026, 12)

const people: SummaryPersonRow[] = [
  { id: "amaka", first_name: "Amaka", last_name: "Obi", department: "IT and Communications" },
  { id: "chidi", first_name: "Chidi", last_name: "Eze", department: "IT and Communications" },
]

const task = (overrides: Partial<SummaryTaskRow>): SummaryTaskRow => ({
  assigned_to: "amaka",
  status: "pending",
  completed_at: null,
  due_date: null,
  task_end_date: null,
  created_at: "2026-07-01T09:00:00Z",
  ...overrides,
})

test("getWeeklyTaskWindow: the seven days before the meeting Monday, in Lagos time", () => {
  assert.equal(window.startDate, "2026-07-27")
  assert.equal(window.endDate, "2026-08-02")
  assert.equal(window.startAt, "2026-07-26T23:00:00.000Z")
  assert.equal(window.endAt, "2026-08-02T23:00:00.000Z")
})

test("summarizeWeeklyTasks: counts done-in-window over owed-in-window", () => {
  const [dept] = summarizeWeeklyTasks(
    [
      // Done in the window.
      task({ status: "completed", completed_at: "2026-07-29T10:00:00Z", due_date: "2026-07-30" }),
      // Due in the window, still open.
      task({ due_date: "2026-08-01" }),
      // Finished early in the window although due next week.
      task({ status: "completed", completed_at: "2026-08-01T12:00:00Z", due_date: "2026-08-07" }),
      // Due in the window but finished the week before: an earlier report's.
      task({ status: "completed", completed_at: "2026-07-24T12:00:00Z", due_date: "2026-07-28" }),
      // Due next week, not started: not this week's.
      task({ due_date: "2026-08-05" }),
      // Chidi owed three, finished none.
      task({ assigned_to: "chidi", due_date: "2026-07-27" }),
      task({ assigned_to: "chidi", task_end_date: "2026-08-02" }),
      task({ assigned_to: "chidi", status: "submitted_for_review", due_date: "2026-07-31" }),
    ],
    people,
    window
  )

  assert.equal(dept.completed, 2)
  assert.equal(dept.assigned, 6)
  assert.deepEqual(
    dept.people.map((p) => [p.name, p.completed, p.assigned]),
    [
      ["Amaka Obi", 2, 3],
      ["Chidi Eze", 0, 3],
    ]
  )
})

test("summarizeWeeklyTasks: completion just after Sunday midnight WAT falls in the next week", () => {
  const summaries = summarizeWeeklyTasks(
    [task({ status: "completed", completed_at: "2026-08-02T23:30:00Z", due_date: "2026-08-04" })],
    people,
    window
  )
  assert.equal(summaries.length, 0)
})

test("summarizeWeeklyTasks: skips assignees with no department", () => {
  const summaries = summarizeWeeklyTasks(
    [task({ assigned_to: "ghost", due_date: "2026-07-28" })],
    [{ id: "ghost", first_name: "No", last_name: "Dept", department: null }],
    window
  )
  assert.deepEqual(summaries, [])
})
