import assert from "node:assert/strict"
import test from "node:test"
import {
  attachActionPoints,
  attachOpenTasks,
  attachPendingChallenges,
  getPreviousOfficeWeek,
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
  const [dept] = summarizeWeeklyTasks(
    [task({ status: "completed", completed_at: "2026-08-02T23:30:00Z", due_date: "2026-08-04" })],
    people,
    window
  )
  assert.equal(dept.assigned, 0)
  assert.equal(dept.completed, 0)
})

test("summarizeWeeklyTasks: skips assignees with no department", () => {
  const summaries = summarizeWeeklyTasks(
    [task({ assigned_to: "ghost", due_date: "2026-07-28" })],
    [{ id: "ghost", first_name: "No", last_name: "Dept", department: null }],
    window
  )
  assert.deepEqual(summaries, [])
})

test("getPreviousOfficeWeek: week N's meeting reviews week N-1's action points", () => {
  assert.deepEqual(getPreviousOfficeWeek(30, 2026), { week: 29, year: 2026 })
  assert.deepEqual(getPreviousOfficeWeek(1, 2026), { week: 52, year: 2025 })
})

test("attachActionPoints: counts by status and adds departments with no tasks", () => {
  const [tasksDept] = summarizeWeeklyTasks([task({ due_date: "2026-07-28" })], people, window)
  const result = attachActionPoints(
    [tasksDept],
    [
      { department: "IT and Communications", status: "completed" },
      { department: "IT and Communications", status: "in_progress" },
      { department: "IT and Communications", status: "pending" },
      { department: "IT and Communications", status: "not_started" },
      { department: "Accounts", status: "completed" },
      { department: null, status: "completed" },
    ]
  )
  const it = result.find((d) => d.people.length > 0)
  const accounts = result.find((d) => d.people.length === 0)
  assert.deepEqual(it?.actionPoints, { total: 4, completed: 1, inProgress: 1, notStarted: 2 })
  assert.deepEqual(accounts?.actionPoints, { total: 1, completed: 1, inProgress: 0, notStarted: 0 })
  assert.equal(accounts?.assigned, 0)
})

test("summarizeWeeklyTasks: department members with no tasks show as 0 / 0, last", () => {
  const [dept] = summarizeWeeklyTasks(
    [task({ assigned_to: "amaka", due_date: "2026-07-28" })],
    [...people, { id: "bola", first_name: "Bola", last_name: "Ade", department: "IT and Communications" }],
    window
  )
  assert.deepEqual(
    dept.people.map((p) => [p.name, p.completed, p.assigned]),
    [
      ["Amaka Obi", 0, 1],
      ["Bola Ade", 0, 0],
      ["Chidi Eze", 0, 0],
    ]
  )
})

// Week 30's meeting is Mon 3 Aug, so the week it plans is Mon 3 — Sun 9 Aug:
// the seven days before week 31's meeting.
const comingWeek = getWeeklyTaskWindow(31, 2026, 12)

test("attachOpenTasks: due in the coming week vs already past due, real deadlines only", () => {
  const [dept] = attachOpenTasks(
    summarizeWeeklyTasks([], people, window),
    [
      task({ due_date: "2026-08-03" }), // due Monday
      task({ task_end_date: "2026-08-09" }), // due Sunday
      task({ due_date: "2026-08-10" }), // next-next week: neither
      task({ assigned_to: "chidi", due_date: "2026-07-20" }), // 14 days overdue
      task({ assigned_to: "chidi", due_date: "2026-08-01" }), // 2 days overdue
      task({ assigned_to: "chidi" }), // no deadline: ignored even though created long ago
    ],
    people,
    comingWeek
  )
  assert.equal(comingWeek.startDate, "2026-08-03")
  assert.deepEqual(
    dept.dueThisWeek.people.map((p) => [p.name, p.count]),
    [
      ["Amaka Obi", 2],
      ["Chidi Eze", 0],
    ]
  )
  assert.equal(dept.overdue.total, 2)
  assert.equal(dept.overdue.oldestDays, 14)
  assert.deepEqual(
    dept.overdue.people.map((p) => [p.name, p.count]),
    [["Chidi Eze", 2]]
  )
})

test("attachPendingChallenges: open or mitigating from earlier weeks only", () => {
  const [dept] = attachPendingChallenges(
    summarizeWeeklyTasks([], people, window),
    [
      { department: "IT and Communications", status: "open", week_number: 24, year: 2026 },
      { department: "IT and Communications", status: "mitigating", week_number: 29, year: 2026 },
      { department: "IT and Communications", status: "open", week_number: 30, year: 2026 }, // this week's
      { department: "IT and Communications", status: "resolved", week_number: 20, year: 2026 },
      { department: "IT and Communications", status: "open", week_number: 50, year: 2025 },
    ],
    30,
    2026
  )
  assert.deepEqual(dept.pendingChallenges, { total: 3, open: 2, mitigating: 1, oldest: { week: 50, year: 2025 } })
})
