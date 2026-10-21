import { z } from "zod"

/**
 * The rules that stop a leave request from being submitted, as one zod schema.
 * The form lists every missing item, in the order the form asks for them, so
 * `superRefine` adds each issue in that order and `leaveRequestMissing` returns
 * the messages.
 */
export interface LeaveRequestRuleInput {
  leave_type_id: string
  segments: readonly unknown[]
  reason: string
  reliever_identifier: string
  handover_file: unknown
  handover_checklist_url: string | null | undefined
  attachment: unknown
}

export interface LeaveRequestRuleContext {
  totalDays: number
  availableDays: number
  requiresAttachment: boolean
}

export function leaveRequestSchema(context: LeaveRequestRuleContext) {
  return z.custom<LeaveRequestRuleInput>().superRefine((value, ctx) => {
    const v = value as LeaveRequestRuleInput
    const add = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message })

    if (!v.leave_type_id) add("Choose a leave type")

    if (v.segments.length === 0) {
      add("Pick your leave dates")
    } else if (context.totalDays <= 0) {
      add("Pick at least one working day")
    } else if (v.leave_type_id && context.totalDays > context.availableDays) {
      const days = `${context.totalDays} day${context.totalDays === 1 ? "" : "s"}`
      add(`This request is ${days}; you have ${context.availableDays} available`)
    }

    if (!v.reason) add("Give a reason")
    if (!v.reliever_identifier) add("Choose a reliever")
    if (!v.handover_file && !v.handover_checklist_url) add("Attach your handover document")
    if (context.requiresAttachment && !v.attachment) add("Attach the document this leave type requires")
  })
}

/** Every reason the request cannot be submitted yet, in form order. */
export function leaveRequestMissing(input: LeaveRequestRuleInput, context: LeaveRequestRuleContext): string[] {
  const result = leaveRequestSchema(context).safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.message)
}
