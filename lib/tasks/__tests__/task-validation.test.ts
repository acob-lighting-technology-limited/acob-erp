import test from "node:test"
import assert from "node:assert/strict"
import { TaskBodySchema, TaskSeriesBodySchema } from "../schemas"
import { validateTaskForm } from "@/app/admin/tasks/management/tasks-content-utils"
import { EMPTY_TASK_FORM, type TaskFormState } from "@/components/tasks/TaskFormDialog"

const validKpiId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const validUserId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

const baseTaskPayload = {
  title: "Valid task title",
  description: "Valid description",
  priority: "medium",
  status: "pending" as const,
  kpi_id: validKpiId,
  weight: 3,
}

test("TaskBodySchema enforces title length boundaries (3 to 200 chars)", () => {
  // Min boundary
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, title: "ab" }).success, false)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, title: "abc" }).success, true)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, title: "   " }).success, false)

  // Max boundary
  const title200 = "a".repeat(200)
  const title201 = "a".repeat(201)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, title: title200 }).success, true)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, title: title201 }).success, false)
})

test("TaskBodySchema enforces description max limit (5000 chars) and allows optional/null", () => {
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, description: null }).success, true)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, description: undefined }).success, true)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, description: "" }).success, true)

  const desc5000 = "d".repeat(5000)
  const desc5001 = "d".repeat(5001)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, description: desc5000 }).success, true)
  assert.equal(TaskBodySchema.safeParse({ ...baseTaskPayload, description: desc5001 }).success, false)
})

test("TaskSeriesBodySchema enforces title and description constraints", () => {
  const seriesPayload = {
    title: "ab",
    kpi_id: validKpiId,
    weight: 3,
    frequency: "weekly" as const,
    weekday: 1,
    start_date: "2026-11-04",
  }
  assert.equal(TaskSeriesBodySchema.safeParse(seriesPayload).success, false)

  const validSeriesPayload = {
    ...seriesPayload,
    title: "Weekly team standup and sync",
    description: "d".repeat(5000),
  }
  assert.equal(TaskSeriesBodySchema.safeParse(validSeriesPayload).success, true)

  const overLimitDesc = {
    ...validSeriesPayload,
    description: "d".repeat(5001),
  }
  assert.equal(TaskSeriesBodySchema.safeParse(overLimitDesc).success, false)
})

test("validateTaskForm enforces title 3-200 and description <= 5000", () => {
  const form: TaskFormState = {
    ...EMPTY_TASK_FORM,
    title: "ab",
    assigned_to: validUserId,
    department: "IT",
    due_date: "2026-11-10",
    kpi_id: validKpiId,
    task_start_date: "2026-11-04",
    task_end_date: "2026-11-10",
  }

  assert.equal(validateTaskForm(form), "Task title must be at least 3 characters")

  form.title = "a".repeat(201)
  assert.equal(validateTaskForm(form), "Task title must be at most 200 characters")

  form.title = "Valid title"
  form.description = "d".repeat(5001)
  assert.equal(validateTaskForm(form), "Task description cannot exceed 5,000 characters")

  form.description = "Valid short description"
  assert.equal(validateTaskForm(form), null)
})
