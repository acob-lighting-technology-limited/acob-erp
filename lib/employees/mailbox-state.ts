import { z } from "zod"

/** An employee's company mailbox, as shown in the Change Status dialog. */
export interface EmployeeMailboxState {
  email: string | null
  /** Matrix can manage this mailbox (cPanel configured and a cPanel staff address). */
  managed: boolean
  exists: boolean
  suspendedLogin: boolean
  /** Addresses mail to this mailbox is currently forwarded to. */
  forwards: string[]
  /** Their department lead — the default forward target on exit. */
  suggestedForward: string | null
  /** Set when cPanel could not be read. */
  error: string | null
}

/** Mailbox steps confirmed alongside an employment status change. */
export const EmployeeMailboxActionsSchema = z.object({
  suspendLogin: z.boolean().optional(),
  restoreLogin: z.boolean().optional(),
  forwardTo: z.string().trim().toLowerCase().email("Forward address must be a valid email").nullable().optional(),
  removeForwards: z.array(z.string().trim().toLowerCase().email()).optional(),
})

export type EmployeeMailboxActions = z.infer<typeof EmployeeMailboxActionsSchema>
