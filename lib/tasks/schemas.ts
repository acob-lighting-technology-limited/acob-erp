import { z } from "zod"
import { TASK_STATUSES, TASK_ASSIGNMENT_TYPES } from "./constants"
import { TASK_WEIGHT_MAX, TASK_WEIGHT_MIN } from "./scoring"

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
