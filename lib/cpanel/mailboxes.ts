import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"
import { getAccountUsage, listMailboxes, type CpanelAccountUsage, type CpanelMailbox } from "./client"
import { MAILBOX_ALERT_PERCENT } from "./quota"

export type MailboxOwnerKind = "staff" | "inactive_staff" | "project" | "none"

export interface MailboxProject {
  id: string
  name: string
  source?: "direct" | "starlink"
}

export interface MailboxOwner {
  id: string
  name: string
  department: string | null
  employmentStatus: string
}

export interface MailboxReportRow extends CpanelMailbox {
  owner: MailboxOwner | null
  /** Set when the mailbox is assigned to a project (directly or via a project Starlink kit). */
  project: MailboxProject | null
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
  project: { id: string; project_name: string } | Array<{ id: string; project_name: string }> | null
}

interface ProjectMailboxRow {
  email: string | null
  project: { id: string; project_name: string } | Array<{ id: string; project_name: string }> | null
}

const INACTIVE_STATUSES = new Set(["exited", "suspended"])

function profileName(p: ProfileRow): string {
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unnamed"
}

/**
 * Compares every cPanel mailbox with the staff profiles, project mailboxes, and site kits.
 * Needs a service-role client: the report spans every employee and project.
 */
export async function loadMailboxReport(serviceClient: SupabaseClient): Promise<MailboxReport> {
  const [mailboxes, account, profilesResult, sitesResult, projectMailboxesResult] = await Promise.all([
    listMailboxes(),
    getAccountUsage(),
    serviceClient
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, department, company_email, employment_status, mailbox_status, mailbox_error"
      )
      .not("company_email", "is", null),
    serviceClient
      .from("starlink_sites")
      .select("email, site_name, project:projects(id, project_name)")
      .not("email", "is", null),
    serviceClient
      .from("project_mailboxes")
      .select("email, project:projects(id, project_name)")
      .not("email", "is", null),
  ])
  if (profilesResult.error) throw new Error(profilesResult.error.message)
  if (sitesResult.error) throw new Error(sitesResult.error.message)
  const projectMailboxesData = projectMailboxesResult.error
    ? []
    : ((projectMailboxesResult.data ?? []) as ProjectMailboxRow[])

  const projectsByEmail = new Map<string, MailboxProject>()

  // 1. Map Starlink kit emails directly to their project
  for (const s of (sitesResult.data ?? []) as SiteRow[]) {
    const email = s.email?.trim().toLowerCase()
    if (!email) continue
    const project = Array.isArray(s.project) ? s.project[0] : s.project
    const projectName = project?.project_name ?? s.site_name
    projectsByEmail.set(email, {
      id: project?.id ?? s.site_name,
      name: projectName,
      source: "starlink",
    })
  }

  // 2. Direct project mailboxes from project_mailboxes
  for (const pm of projectMailboxesData) {
    const email = pm.email?.trim().toLowerCase()
    if (!email) continue
    const project = Array.isArray(pm.project) ? pm.project[0] : pm.project
    if (project) {
      projectsByEmail.set(email, { id: project.id, name: project.project_name, source: "direct" })
    }
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
    const project = p ? null : (projectsByEmail.get(m.email) ?? null)
    const ownerKind: MailboxOwnerKind = p ? (inactive ? "inactive_staff" : "staff") : project ? "project" : "none"

    return {
      ...m,
      owner,
      project,
      ownerKind,
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
