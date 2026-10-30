import { z } from "zod"
import { TASK_STATUSES, TASK_ASSIGNMENT_TYPES } from "./constants"
import { TASK_WEIGHT_MAX, TASK_WEIGHT_MIN } from "./scoring"
import { SERIES_FREQUENCIES, SERIES_MONTH_MODES } from "./recurrence"

export const TaskBodySchema = z.object({
  title: z.string().trim().min(1, "Task title is required"),
  description: z.string().optional().nullable(),
  priority: z.string().trim().min(1).default("medium"),
  status: z.enum(TASK_STATUSES).default("pending"),
  due_date: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assignment_type: z.enum(TASK_ASSIGNMENT_TYPES).default("individual"),
  assigned_to: z.string().uuid().optional().nullable(),
  assigned_users: z.array(z.string().uuid()).optional().default([]),
  goal_id: z.string().uuid().optional().nullable(),
  // Compulsory: every task must be linked to a Corporate KPI.
  kpi_id: z.string().uuid("Corporate KPI is required"),
  project_id: z.string().uuid().optional().nullable(),
  plan_id: z.string().uuid().optional().nullable(),
  // Portfolio-wide work; mutually exclusive with project_id (see lib/tasks/work-links).
  portfolio_id: z.string().uuid().optional().nullable(),
  // Compulsory: task weight is the denominator of the employee's KPI score.
  weight: z
    .number()
    .int()
    .min(TASK_WEIGHT_MIN, `Task weight must be between ${TASK_WEIGHT_MIN} and ${TASK_WEIGHT_MAX}`)
    .max(TASK_WEIGHT_MAX, `Task weight must be between ${TASK_WEIGHT_MIN} and ${TASK_WEIGHT_MAX}`),
  task_start_date: z.string().optional().nullable(),
  task_end_date: z.string().optional().nullable(),
  source_type: z.enum(["manual", "help_desk", "action_item"]).default("manual"),
})

export type TaskInput = z.infer<typeof TaskBodySchema>

// ── Recurring task series ───────────────────────────────────────────────

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")

/**
 * Creating a recurring task. The same fields a one-off task takes, minus its
 * dates: a series has a schedule instead, and each repeat gets its deadline
 * from it. Several assignees make one series each, as they make one task each.
 */
export const TaskSeriesBodySchema = z
  .object({
    title: z.string().trim().min(1, "Task title is required"),
    description: z.string().optional().nullable(),
    priority: z.string().trim().min(1).default("medium"),
    department: z.string().optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    assigned_users: z.array(z.string().uuid()).optional().default([]),
    goal_id: z.string().uuid().optional().nullable(),
    kpi_id: z.string().uuid("Corporate KPI is required"),
    project_id: z.string().uuid().optional().nullable(),
    plan_id: z.string().uuid().optional().nullable(),
    portfolio_id: z.string().uuid().optional().nullable(),
    weight: z
      .number()
      .int()
      .min(TASK_WEIGHT_MIN, `Task weight must be between ${TASK_WEIGHT_MIN} and ${TASK_WEIGHT_MAX}`)
      .max(TASK_WEIGHT_MAX, `Task weight must be between ${TASK_WEIGHT_MIN} and ${TASK_WEIGHT_MAX}`),
    frequency: z.enum(SERIES_FREQUENCIES),
    weekday: z.number().int().min(1).max(5).optional().nullable(),
    month_mode: z.enum(SERIES_MONTH_MODES).optional().nullable(),
    month_day: z.number().int().min(1).max(31).optional().nullable(),
    year_month: z.number().int().min(1).max(12).optional().nullable(),
    start_date: IsoDate,
    end_date: IsoDate.optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === "weekly" && !value.weekday) {
      ctx.addIssue({ code: "custom", path: ["weekday"], message: "Choose the weekday it is due" })
    }
    if (value.frequency === "monthly" || value.frequency === "yearly") {
      if (!value.month_mode) {
        ctx.addIssue({ code: "custom", path: ["month_mode"], message: "Choose a day of the month or the last day" })
      } else if (value.month_mode === "day" && !value.month_day) {
        ctx.addIssue({ code: "custom", path: ["month_day"], message: "Choose the day of the month it is due" })
      }
    }
    if (value.frequency === "yearly" && !value.year_month) {
      ctx.addIssue({ code: "custom", path: ["year_month"], message: "Choose the month it is due" })
    }
    if (value.end_date && value.end_date < value.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "The end date must be on or after the start date" })
    }
  })

export type TaskSeriesInput = z.infer<typeof TaskSeriesBodySchema>

/** Everything a lead can do to a series once it exists. */
export const TaskSeriesActionSchema = z.discriminatedUnion("action", [
  // Applies to repeats not yet created. The schedule itself is fixed: changing
  // it would leave created repeats on dates the new schedule does not have,
  // so a different schedule is a new series.
  z.object({
    action: z.literal("edit"),
    title: z.string().trim().min(1).optional(),
    description: z.string().optional().nullable(),
    priority: z.string().trim().min(1).optional(),
    weight: z.number().int().min(TASK_WEIGHT_MIN).max(TASK_WEIGHT_MAX).optional(),
    kpi_id: z.string().uuid().optional(),
    goal_id: z.string().uuid().optional().nullable(),
    end_date: IsoDate.optional().nullable(),
  }),
  z.object({
    action: z.literal("reassign"),
    assigned_to: z.string().uuid(),
    effective_from: IsoDate,
    // Also hand over open repeats dated before effective_from - typically
    // today's, already under way.
    move_open: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("pause"),
    from: IsoDate,
    until: IsoDate.optional().nullable(),
    // false returns what the pause would do, for the heads-up; true applies it.
    confirm: z.boolean().default(false),
  }),
  z.object({ action: z.literal("resume") }),
  z.object({
    action: z.literal("end"),
    reason: z.enum(["completed_early", "no_longer_needed"]),
    note: z.string().trim().max(2000).optional(),
  }),
])

export type TaskSeriesAction = z.infer<typeof TaskSeriesActionSchema>
