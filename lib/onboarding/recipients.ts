import type { SupabaseClient } from "@supabase/supabase-js"
import { ORG_HR_EMAIL, ORG_ICT_EMAIL } from "@/lib/org-config"
import { DEPT_ADMIN_HR, DEPT_CORPORATE_SERVICES, DEPT_ITC, normalizeDepartmentName } from "@/shared/departments"

// Who hears about a new hire, and when:
//   1. Form submitted      -> Admin & HR lead + the Admin & HR inbox
//   2. Application approved -> the ICT inbox, to create the webmail account
//   3. Credentials sent     -> HCS + Admin & HR lead + the new hire's department lead
// Inboxes come from departments.email; the env-configurable ORG_* addresses are
// only a fallback for a department whose email has not been filled in.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OnboardingClient = SupabaseClient<any, any, any>

interface LeadProfileRow {
  department: string | null
  lead_departments: string[] | null
  company_email: string | null
  additional_email: string | null
}

export function normalizeEmails(emails: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) =>
          String(email || "")
            .trim()
            .toLowerCase()
        )
        .filter((email) => email.length > 0 && email.includes("@"))
    )
  )
}

/** Emails of the active leads of one department (own department or via lead_departments). */
export async function resolveDepartmentLeadEmails(client: OnboardingClient, department: string): Promise<string[]> {
  const target = normalizeDepartmentName(department)
  if (!target) return []

  const { data, error } = await client
    .from("profiles")
    .select("department, lead_departments, company_email, additional_email")
    .eq("is_department_lead", true)
    .eq("employment_status", "active")
  if (error) throw new Error(`Failed to resolve ${department} lead: ${error.message}`)

  const leads = ((data || []) as LeadProfileRow[]).filter((profile) => {
    const managed = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
    return (
      normalizeDepartmentName(profile.department ?? "") === target ||
      managed.some((dept) => normalizeDepartmentName(dept) === target)
    )
  })

  return normalizeEmails(leads.flatMap((lead) => [lead.company_email, lead.additional_email]))
}

/** The official inbox recorded on the department row (departments.email), if any. */
export async function resolveDepartmentInboxEmail(
  client: OnboardingClient,
  department: string
): Promise<string | null> {
  const target = normalizeDepartmentName(department)
  const { data, error } = await client.from("departments").select("name, email").eq("is_active", true)
  if (error) throw new Error(`Failed to resolve ${department} inbox: ${error.message}`)

  const match = ((data || []) as Array<{ name: string | null; email: string | null }>).find(
    (row) => normalizeDepartmentName(row.name ?? "") === target
  )
  return normalizeEmails([match?.email])[0] ?? null
}

/** Step 1: the Admin & HR lead plus the Admin & HR inbox. */
export async function resolveSubmissionRecipients(client: OnboardingClient): Promise<string[]> {
  const [leadEmails, inbox] = await Promise.all([
    resolveDepartmentLeadEmails(client, DEPT_ADMIN_HR),
    resolveDepartmentInboxEmail(client, DEPT_ADMIN_HR),
  ])
  return normalizeEmails([...leadEmails, inbox || ORG_HR_EMAIL])
}

/** Step 2: the ICT inbox that provisions webmail accounts. */
export async function resolveIctSetupRecipients(client: OnboardingClient): Promise<string[]> {
  const inbox = await resolveDepartmentInboxEmail(client, DEPT_ITC)
  return normalizeEmails([inbox || ORG_ICT_EMAIL])
}

/**
 * Step 3: HCS, the Admin & HR lead and the new hire's department lead. A
 * department with no lead simply adds nobody, leaving HCS and the HR lead.
 * With no Admin & HR lead on record, the Admin & HR inbox stands in.
 */
export async function resolveOnboardedNoticeRecipients(
  client: OnboardingClient,
  newHireDepartment: string | null | undefined
): Promise<string[]> {
  const [hcsEmails, adminHrLeadEmails, departmentLeadEmails] = await Promise.all([
    resolveDepartmentLeadEmails(client, DEPT_CORPORATE_SERVICES),
    resolveDepartmentLeadEmails(client, DEPT_ADMIN_HR),
    newHireDepartment ? resolveDepartmentLeadEmails(client, newHireDepartment) : Promise.resolve([]),
  ])

  const hrEmails =
    adminHrLeadEmails.length > 0
      ? adminHrLeadEmails
      : [(await resolveDepartmentInboxEmail(client, DEPT_ADMIN_HR)) || ORG_HR_EMAIL]

  return normalizeEmails([...hcsEmails, ...hrEmails, ...departmentLeadEmails])
}
