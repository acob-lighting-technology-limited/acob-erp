import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"
import { getAccountUsage, listMailboxes, type CpanelAccountUsage, type CpanelMailbox } from "./client"
import { MAILBOX_ALERT_PERCENT } from "./quota"

export type MailboxOwnerKind = "staff" | "inactive_staff" | "site" | "none"

/** A project-site mailbox: the login email of a Starlink kit recorded in Matrix. */
export interface MailboxSite {
  name: string
  projectName: string | null
}

export interface MailboxOwner {
  id: string
  name: string
  department: string | null
  employmentStatus: string
}

export interface MailboxReportRow extends CpanelMailbox {
  owner: MailboxOwner | null
  /** Set when no employee owns the mailbox but a Starlink kit logs in with it. */
  site: MailboxSite | null
  ownerKind: MailboxOwnerKind
  /** Owner has left or is suspended, but the mailbox still lets them log in. */
  inactiveOwnerCanLogIn: boolean
  needsAttention: boolean
}

export interface MissingMailboxRow {
  profileId: string
  name: string
  department: string | null
  email: string
  employmentStatus: string
  /** cPanel's reason when Matrix's own attempt to create the mailbox failed. */
  provisioningError: string | null
}

export interface MailboxReport {
  mailboxes: MailboxReportRow[]
  /** Staff whose company email is on the staff domain but has no mailbox on cPanel. */
  missing: MissingMailboxRow[]
  account: CpanelAccountUsage
  staffDomain: string
}

interface ProfileRow {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
  company_email: string | null
  employment_status: string | null
  mailbox_status: string | null
  mailbox_error: string | null
}

interface SiteRow {
  email: string | null
  site_name: string
  project: { project_name: string } | Array<{ project_name: string }> | null
}

const INACTIVE_STATUSES = new Set(["exited", "suspended"])

function profileName(p: ProfileRow): string {
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unnamed"
}

/**
 * Compares every cPanel mailbox with the staff profiles. Needs a service-role
 * client: the report spans every employee, and profiles RLS shows a normal
 * user only their own row.
 */
export async function loadMailboxReport(serviceClient: SupabaseClient): Promise<MailboxReport> {
  const [mailboxes, account, profilesResult, sitesResult] = await Promise.all([
    listMailboxes(),
    getAccountUsage(),
    serviceClient
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, department, company_email, employment_status, mailbox_status, mailbox_error"
      )
      .not("company_email", "is", null),
    // Site mailboxes are recognised from the Starlink kits' login emails, so
    // a site is labelled as soon as its kit is added — nothing else to maintain.
    serviceClient
      .from("starlink_sites")
      .select("email, site_name, project:projects(project_name)")
      .not("email", "is", null),
  ])
  if (profilesResult.error) throw new Error(profilesResult.error.message)
  if (sitesResult.error) throw new Error(sitesResult.error.message)

  const sitesByEmail = new Map<string, MailboxSite>()
  for (const s of (sitesResult.data ?? []) as SiteRow[]) {
    const email = s.email?.trim().toLowerCase()
    if (!email) continue
    const project = Array.isArray(s.project) ? s.project[0] : s.project
    sitesByEmail.set(email, { name: s.site_name, projectName: project?.project_name ?? null })
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[]
  const byEmail = new Map<string, ProfileRow>()
  for (const p of profiles) {
    const email = p.company_email?.trim().toLowerCase()
    if (email) byEmail.set(email, p)
  }

  const rows: MailboxReportRow[] = mailboxes.map((m) => {
    const p = byEmail.get(m.email)
    const status = p?.employment_status ?? "active"
    const inactive = p ? INACTIVE_STATUSES.has(status) : false
    const owner: MailboxOwner | null = p
      ? { id: p.id, name: profileName(p), department: p.department, employmentStatus: status }
      : null
    const inactiveOwnerCanLogIn = inactive && !m.suspendedLogin
    const site = p ? null : (sitesByEmail.get(m.email) ?? null)
    return {
      ...m,
      owner,
      site,
      ownerKind: p ? (inactive ? "inactive_staff" : "staff") : site ? "site" : "none",
      inactiveOwnerCanLogIn,
      needsAttention: inactiveOwnerCanLogIn || (m.usedPercent ?? 0) >= MAILBOX_ALERT_PERCENT,
    }
  })

  const mailboxEmails = new Set(mailboxes.map((m) => m.email))
  const staffDomain = ORG_STAFF_DOMAIN.toLowerCase()
  const missing: MissingMailboxRow[] = profiles
    .filter((p) => {
      const email = p.company_email?.trim().toLowerCase() ?? ""
      return email.endsWith(`@${staffDomain}`) && !mailboxEmails.has(email) && p.employment_status !== "exited"
    })
    .map((p) => ({
      profileId: p.id,
      name: profileName(p),
      department: p.department,
      email: (p.company_email ?? "").trim().toLowerCase(),
      employmentStatus: p.employment_status ?? "active",
      provisioningError: p.mailbox_status === "failed" ? (p.mailbox_error ?? "Failed") : null,
    }))

  return { mailboxes: rows, missing, account, staffDomain }
}
