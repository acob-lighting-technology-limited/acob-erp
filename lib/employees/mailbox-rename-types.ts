import { z } from "zod"

/** What the admin confirmed in the email-change dialog. */
export const MailboxRenameOptionsSchema = z.object({
  forwardOld: z.boolean().default(true),
  suspendOldLogin: z.boolean().default(false),
})

export type MailboxRenameOptions = z.infer<typeof MailboxRenameOptionsSchema>

export interface MailboxRenameResult {
  /** The new mailbox's password, shown once to the admin. null when no mailbox was created. */
  password: string | null
  done: string[]
  errors: string[]
}
