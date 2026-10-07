import { z } from "zod"
import { PROJECT_PRIORITIES } from "@/lib/projects/priority"

const optionalUuid = z
  .union([z.string().uuid(), z.literal("")])
  .nullable()
  .optional()

/** Body for creating or fully updating a project (both routes and the project form). */
export const ProjectInputSchema = z
  .object({
    project_name: z.string().trim().min(1, "Project title is required").max(200),
    location: z.string().trim().min(1, "Site location is required").max(200),
    deployment_start_date: z.string().trim().min(1, "Start date is required"),
    deployment_end_date: z.string().trim().min(1, "Target end date is required"),
    capacity_w: z.union([z.number(), z.string()]).nullable().optional(),
    technology_type: z.string().max(100).nullable().optional(),
    project_manager_id: optionalUuid,
    portfolio_id: optionalUuid,
    description: z.string().max(10000).nullable().optional(),
    status: z.string().max(40).optional(),
    priority: z
      .enum(PROJECT_PRIORITIES, { errorMap: () => ({ message: "Priority must be critical, high, medium or low" }) })
      .optional(),
  })
  // ISO dates compare correctly as strings.
  .refine(
    (value) =>
      !value.deployment_start_date ||
      !value.deployment_end_date ||
      value.deployment_end_date >= value.deployment_start_date,
    {
      message: "Target end date cannot be before the start date",
      path: ["deployment_end_date"],
    }
  )

export type ProjectInput = z.input<typeof ProjectInputSchema>

/** Body for adding a task to a project. */
export const ProjectTaskInputSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(300),
  description: z.string().max(10000).nullable().optional(),
  status: z.string().max(40).optional(),
  assigned_to: optionalUuid,
  priority: z.string().max(20).optional(),
  weight: z.number().optional(),
  goal_id: optionalUuid,
})

/** "" or a non-numeric string → null, otherwise the watt capacity as a number. */
export function parseCapacity(value: number | string | null | undefined): number | null {
  if (value === "" || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const PORTFOLIO_STATUSES = ["active", "on_hold", "closed"] as const

/** A portfolio's editable fields — the portfolio form, POST /api/portfolios and PATCH /api/portfolios/[id]. */
export const PortfolioFieldsSchema = z.object({
  name: z.string().trim().min(1, "Portfolio name is required"),
  code: z.string().trim().max(32, "Use 32 characters or fewer").optional().nullable(),
  description: z.string().trim().max(5000, "Use 5,000 characters or fewer").optional().nullable(),
  status: z.enum(PORTFOLIO_STATUSES),
})

export type PortfolioFields = z.infer<typeof PortfolioFieldsSchema>

export const CreatePortfolioSchema = PortfolioFieldsSchema.extend({
  status: PortfolioFieldsSchema.shape.status.default("active"),
})

export const UpdatePortfolioSchema = PortfolioFieldsSchema.partial()
