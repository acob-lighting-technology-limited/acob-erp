import type { SupabaseClient } from "@supabase/supabase-js"
import { renderOnboardingIctSetupEmail } from "@/lib/email-templates/onboarding-ict-setup"
import { isSystemNotificationChannelEnabled } from "@/lib/notifications/delivery-policy"
import { withSubjectPrefix } from "@/lib/notifications/subject-policy"
import { resolveIctSetupRecipients } from "@/lib/onboarding/recipients"
import type { Database } from "@/types/database"

export interface ApprovalPreviewPendingUser {
  first_name: string
  last_name: string
  department: string
  designation: string
  company_email: string
  office_location?: string | null
}

interface ApprovalEmailPreviewParams {
  supabase: SupabaseClient<Database>
  pendingUser: ApprovalPreviewPendingUser
  /** Unknown until approval generates it; the preview shows it as pending. */
  employeeNumber?: string | null
  approvedBy?: {
    name?: string | null
    designation?: string | null
    department?: string | null
  }
  /** Set when Matrix tried to create the mailbox on cPanel and could not; shown to ICT. */
  automationFailure?: string | null
}

interface ApprovalPreviewEmail {
  enabled: boolean
  subject: string
  recipients: string[]
  html: string
}

/**
 * The ICT "create the webmail account" email. Approval now creates the mailbox
 * on cPanel itself; this goes out only when it cannot (cPanel not configured,
 * or the attempt failed — `automationFailure` carries cPanel's reason). The
 * welcome letter and the HCS/HR/lead notice then follow from dispatch-credentials.
 */
export interface ApprovalEmailPreview {
  ict: ApprovalPreviewEmail
}

export async function buildApprovalEmailPreview({
  supabase,
  pendingUser,
  employeeNumber,
  approvedBy,
  automationFailure,
}: ApprovalEmailPreviewParams): Promise<ApprovalEmailPreview> {
  const enabled = await isSystemNotificationChannelEnabled(supabase, "onboarding", "email")
  const name = `${pendingUser.first_name} ${pendingUser.last_name}`.replace(/[\r\n]/g, "")

  return {
    ict: {
      enabled,
      subject: withSubjectPrefix("Onboarding", `Webmail Setup Required - ${name}`),
      recipients: enabled ? await resolveIctSetupRecipients(supabase) : [],
      html: renderOnboardingIctSetupEmail({
        employee: { ...pendingUser, employee_number: employeeNumber ?? "Assigned on approval" },
        approvedBy,
        automationFailure,
      }),
    },
  }
}
