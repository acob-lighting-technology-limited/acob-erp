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
}

interface ApprovalPreviewEmail {
  enabled: boolean
  subject: string
  recipients: string[]
  html: string
}

/**
 * Approval mails only ICT, asking them to create the webmail account. The
 * employee's welcome letter and the HCS/HR/lead notice go out later, from
 * dispatch-credentials, once that account exists.
 */
export interface ApprovalEmailPreview {
  ict: ApprovalPreviewEmail
}

export async function buildApprovalEmailPreview({
  supabase,
  pendingUser,
  employeeNumber,
  approvedBy,
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
      }),
    },
  }
}
