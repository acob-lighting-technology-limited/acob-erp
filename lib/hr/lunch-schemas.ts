import { z } from "zod"
import { isValidDeadlineTime } from "@/lib/hr/lunch-voting"

/** Request-body schemas for the lunch admin routes. Business rules (blank-row
 *  stripping, deadline maths) stay in lunch-menu-server; these check shape. */

const deadlineTime = z.string().refine(isValidDeadlineTime, "deadline_time must be HH:MM")
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A valid date is required")

const MenuGroupInputSchema = z.object({
  name: z.string().max(100).nullable().optional(),
  is_required: z.boolean().optional(),
  options: z
    .array(z.object({ name: z.string().max(200).optional(), description: z.string().max(500).nullable().optional() }))
    .max(50)
    .optional(),
})

export const CreateMenuSchema = z.object({
  date: isoDate,
  status: z.enum(["draft", "published"]).optional(),
  deadline_time: deadlineTime.nullable().optional(),
  groups: z.array(MenuGroupInputSchema).max(20).optional(),
})

export const UpdateMenuSchema = z.object({
  status: z.enum(["draft", "published", "closed"]).optional(),
  deadline_time: deadlineTime.nullable().optional(),
  groups: z.array(MenuGroupInputSchema).max(20).optional(),
  /** Required to rebuild the dishes once votes exist — it discards them. */
  clear_votes: z.boolean().optional(),
  /** Cancels or reinstates the day, taking the lunch charges with it. */
  archived: z.boolean().optional(),
})

export const AdminVoteSchema = z.object({
  userId: z.string().uuid("userId is required"),
  /** false = the NO answer; null = remove the vote entirely. */
  eating: z.boolean().nullable().optional(),
  selections: z.record(z.string(), z.string()).optional(),
})

export const LunchAttendanceSchema = z.object({
  date: isoDate,
  userIds: z.array(z.string().uuid()).max(1000),
})

export const LunchSettingsSchema = z.object({
  cost: z.number().min(0, "Invalid cost or subsidy percentage"),
  subsidy_percent: z.number().min(0).max(100, "Invalid cost or subsidy percentage"),
  eating_days: z
    .array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]))
    .optional(),
  voting_deadline: z.string().refine(isValidDeadlineTime, "Voting deadline must be a time like 07:00").optional(),
  voting_enabled: z.boolean().optional(),
})
