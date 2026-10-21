import { z } from "zod"

const HHMM = /^\d{2}:\d{2}$/
const minutes = (value: string) => {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

/**
 * The attendance policy — the admin settings form and POST /api/admin/settings/attendance.
 * The time-order rules run on the server too, so a direct API call cannot save an
 * end time before the start or a grace cutoff before opening.
 */
export const AttendancePolicySchema = z
  .object({
    startTime: z.string().regex(HHMM, "Start time must be in HH:MM format"),
    endTime: z.string().regex(HHMM, "End time must be in HH:MM format"),
    lateCutoff: z.string().regex(HHMM, "Grace cutoff must be in HH:MM format"),
    incompletePenalty: z
      .number({ invalid_type_error: "Enter a number of hours" })
      .nonnegative("Incomplete penalty must be a positive number")
      .max(9, "Incomplete penalty must be 9 hours or less"),
    lunchMinutes: z
      .number({ invalid_type_error: "Enter a number of minutes" })
      .int("Use whole minutes")
      .min(0)
      .max(240, "Lunch break must be between 0 and 240 minutes"),
    lunchQualifyingHours: z
      .number({ invalid_type_error: "Enter a number of hours" })
      .min(0)
      .max(24, "Qualifying day length must be between 0 and 24 hours"),
    emailNotificationsEnabled: z.boolean().optional(),
  })
  .superRefine((policy, ctx) => {
    if (!HHMM.test(policy.startTime)) return
    if (HHMM.test(policy.lateCutoff) && minutes(policy.lateCutoff) < minutes(policy.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lateCutoff"],
        message: "Grace cutoff time must be after the workday start time.",
      })
    }
    if (HHMM.test(policy.endTime) && minutes(policy.endTime) <= minutes(policy.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "Workday end time must be after the workday start time.",
      })
    }
  })

export type AttendancePolicyInput = z.infer<typeof AttendancePolicySchema>
