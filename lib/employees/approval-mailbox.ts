/**
 * What happened to the new employee's company mailbox during approval —
 * returned by /api/admin/approve-user so the approval toast can say it.
 */
export type ApprovalMailboxOutcome =
  | { status: "created"; email: string; welcomeSent: boolean }
  /** cPanel was reached but refused or errored; ICT was emailed with the reason. */
  | { status: "failed"; email: string; reason: string }
  /** Matrix cannot create this mailbox here (cPanel not configured / not a cPanel domain); ICT was emailed. */
  | { status: "manual"; email: string; reason: string }

/** One-line approval summary for a toast. */
export function describeApprovalMailbox(mailbox: ApprovalMailboxOutcome | undefined): {
  tone: "success" | "warning"
  message: string
} {
  if (!mailbox) return { tone: "success", message: "Employee approved. ICT notified to set up their webmail." }
  if (mailbox.status === "created") {
    return mailbox.welcomeSent
      ? {
          tone: "success",
          message: `Employee approved · mailbox ${mailbox.email} created · welcome letter sent to their personal email.`,
        }
      : {
          tone: "warning",
          message: `Employee approved · mailbox ${mailbox.email} created, but the welcome letter was not sent.`,
        }
  }
  if (mailbox.status === "failed") {
    return {
      tone: "warning",
      message: `Employee approved · mailbox NOT created: ${mailbox.reason}. ICT has been emailed.`,
    }
  }
  return { tone: "success", message: "Employee approved. ICT notified to set up their webmail." }
}
