import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { normalizeDepartmentName, DEPT_ADMIN_HR } from "@/shared/departments"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { ATTENDANCE_STATUS_LABELS, type UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { sendAttendanceMail, type AttendanceMailDetail } from "@/lib/hr/attendance-mailer"
import { isSystemNotificationChannelEnabled } from "@/lib/notifications/delivery-policy"

const log = logger("attendance-notify")

const ADMIN_HR_DEPARTMENT = DEPT_ADMIN_HR

type NotifyClient = SupabaseClient

type ProfileNameEmailRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  company_email: string | null
  additional_email: string | null
}

type LeadProfileRow = {
  id: string
  department: string | null
  lead_departments: string[] | null
  company_email: string | null
  additional_email: string | null
}

function formatName(row: Pick<ProfileNameEmailRow, "full_name" | "first_name" | "last_name"> | null | undefined) {
  if (!row) return "Unknown"
  return row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unknown"
}

function collectEmails(
  row: { company_email: string | null; additional_email: string | null } | null | undefined
): string[] {
  if (!row) return []
  return [row.company_email, row.additional_email].filter(
    (email): email is string => typeof email === "string" && email.includes("@")
  )
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "—"
  return ATTENDANCE_STATUS_LABELS[status as UnifiedAttendanceStatus] ?? status
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Emails of the leads of one department: a lead whose own department matches, or who manages
 * it through `lead_departments`. No fallback - callers decide what an empty result means.
 */
async function departmentLeadEmails(client: NotifyClient, department: string): Promise<string[]> {
  const target = normalizeDepartmentName(department)
  const { data: leads } = await client
    .from("profiles")
    .select("id, department, lead_departments, company_email, additional_email")
    .eq("is_department_lead", true)

  const matches = ((leads ?? []) as LeadProfileRow[]).filter((profile) => {
    const managed = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
    return (
      normalizeDepartmentName(profile.department ?? "") === target ||
      managed.some((dept) => normalizeDepartmentName(dept) === target)
    )
  })

  return matches.flatMap((lead) => collectEmails(lead))
}

/**
 * Resolve the Admin & HR lead's email addresses. Mirrors leave routing: the profile that is a
 * department lead for "Admin & HR". Falls back to super admins when no such lead is configured.
 */
async function resolveAdminHrLeadEmails(client: NotifyClient): Promise<string[]> {
  let emails = await departmentLeadEmails(client, ADMIN_HR_DEPARTMENT)

  if (emails.length === 0) {
    const { data: superAdmins } = await client
      .from("profiles")
      .select("id, company_email, additional_email")
      .eq("is_super_admin", true)
    emails = ((superAdmins ?? []) as Array<Pick<LeadProfileRow, "company_email" | "additional_email">>).flatMap(
      (admin) => collectEmails(admin)
    )
  }

  return Array.from(new Set(emails.map((email) => email.toLowerCase())))
}

/** A decided appeal, as the digest reads it. */
type DecidedAppealRow = {
  id: string
  user_id: string
  appeal_date: string
  current_status: string | null
  requested_status: string | null
  appeal_reason: string | null
  status: "approved" | "rejected" | "resolved"
  resolution_note: string | null
  reviewed_by: string | null
  lead_reviewed_by: string | null
  admin_reviewed_by: string | null
  overridden_by: string | null
  overridden_stage: string | null
  override_reason: string | null
  updated_at: string
}

/**
 * Leave a decision this long before mailing it, so an approver working down the queue lands
 * in one summary instead of being split across two runs.
 */
const DIGEST_QUIET_MINUTES = 5

const DECIDED_APPEAL_COLUMNS =
  "id, user_id, appeal_date, current_status, requested_status, appeal_reason, status, resolution_note, reviewed_by, lead_reviewed_by, admin_reviewed_by, overridden_by, overridden_stage, override_reason, updated_at"

function appealVerb(appeal: DecidedAppealRow): string {
  if (appeal.overridden_by) return "Approved by override"
  if (appeal.status === "approved") return "Approved"
  if (appeal.status === "rejected") return "Rejected"
  return "Resolved"
}

function appealActorId(appeal: DecidedAppealRow): string | null {
  return appeal.overridden_by ?? appeal.admin_reviewed_by ?? appeal.lead_reviewed_by ?? appeal.reviewed_by
}

/** "Absent → Present", or the status the day kept when the appeal was turned down. */
function appealTransition(appeal: DecidedAppealRow): string {
  if (appeal.status === "rejected") return `Stays ${statusLabel(appeal.current_status)}`
  if (appeal.status === "resolved") return `Was ${statusLabel(appeal.current_status)}`
  return `${statusLabel(appeal.current_status)} → ${statusLabel(appeal.requested_status)}`
}

function appealComment(appeal: DecidedAppealRow): string | null {
  return (appeal.overridden_by ? appeal.override_reason : appeal.resolution_note)?.trim() || null
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function groupByEmployee(appeals: DecidedAppealRow[]): Map<string, DecidedAppealRow[]> {
  const groups = new Map<string, DecidedAppealRow[]>()
  for (const appeal of appeals) groups.set(appeal.user_id, [...(groups.get(appeal.user_id) ?? []), appeal])
  return groups
}

/**
 * Emails decided attendance appeals as summaries, never one email per appeal: each employee gets
 * one email listing every day decided for them, and the Admin & HR lead gets one email covering
 * everyone. A Department Lead whose step an override skipped gets a summary of those overrides.
 *
 * Run by /api/cron/attendance/appeal-digest. Each appeal is claimed (decision_emailed_at stamped)
 * before anything is sent, so a rerun or an overlapping run never mails it twice; a failed send
 * is logged by the gateway and not retried. Appeals closed by a device sync are stamped when they
 * are closed and never reach here. With attendance email switched off, appeals are still claimed
 * so switching it back on does not release a backlog.
 */
export async function sendAppealDecisionDigest(client: NotifyClient): Promise<{ appeals: number; emails: number }> {
  const quietBefore = new Date(Date.now() - DIGEST_QUIET_MINUTES * 60 * 1000).toISOString()
  const { data: claimed, error } = await client
    .from("attendance_appeals")
    .update({ decision_emailed_at: new Date().toISOString() })
    .in("status", ["approved", "rejected", "resolved"])
    .is("decision_emailed_at", null)
    .lt("updated_at", quietBefore)
    .select(DECIDED_APPEAL_COLUMNS)
    .returns<DecidedAppealRow[]>()
  if (error) throw new Error(`Failed to claim decided appeals: ${error.message}`)

  const appeals = [...(claimed ?? [])].sort((a, b) => a.appeal_date.localeCompare(b.appeal_date))
  if (appeals.length === 0) return { appeals: 0, emails: 0 }

  if (!(await isSystemNotificationChannelEnabled(client, "attendance", "email"))) {
    return { appeals: appeals.length, emails: 0 }
  }
  const policy = await loadAttendancePolicy(client)
  if (policy.emailNotificationsEnabled === false) return { appeals: appeals.length, emails: 0 }

  const personIds = new Set<string>()
  for (const appeal of appeals) {
    personIds.add(appeal.user_id)
    const actorId = appealActorId(appeal)
    if (actorId) personIds.add(actorId)
  }
  const { data: people } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name, company_email, additional_email, department")
    .in("id", [...personIds])
    .returns<Array<ProfileNameEmailRow & { department: string | null }>>()
  const profileMap = new Map((people ?? []).map((row) => [row.id, row]))
  const nameOf = (id: string) => formatName(profileMap.get(id))

  let emails = 0

  // ── One email per employee ──
  for (const [userId, decided] of groupByEmployee(appeals)) {
    const to = collectEmails(profileMap.get(userId))
    if (to.length === 0) continue
    const only = decided.length === 1 ? decided[0] : null
    await sendAttendanceMail({
      to,
      subject: only
        ? `Attendance Appeal ${appealVerb(only)} — ${only.appeal_date}`
        : `Attendance Appeals Decided — ${countLabel(decided.length, "day")}`,
      title: only ? `Attendance Appeal ${appealVerb(only)}` : "Your Attendance Appeals",
      message: only
        ? `Your attendance appeal for ${only.appeal_date} has been ${appealVerb(only).toLowerCase()}.`
        : `Your attendance appeals for ${countLabel(decided.length, "day")} have been decided. The outcome for each day is below.`,
      detailsTitle: only ? "Appeal Details" : "Decided Days",
      details: decided.map((appeal) => {
        const comment = appealComment(appeal)
        return {
          label: appeal.appeal_date,
          value: [appealVerb(appeal), appealTransition(appeal), comment ? `Comment: ${comment}` : null]
            .filter(Boolean)
            .join(" · "),
        }
      }),
    })
    emails += 1
  }

  // ── One email per lead, one card per employee ──
  const appealsByLeadEmail = new Map<string, DecidedAppealRow[]>()
  for (const email of await resolveAdminHrLeadEmails(client)) appealsByLeadEmail.set(email, appeals)

  const skippedByDepartment = new Map<string, DecidedAppealRow[]>()
  for (const appeal of appeals) {
    const department = profileMap.get(appeal.user_id)?.department
    if (!appeal.overridden_by || appeal.overridden_stage !== "pending_lead" || !department) continue
    skippedByDepartment.set(department, [...(skippedByDepartment.get(department) ?? []), appeal])
  }
  for (const [department, skipped] of skippedByDepartment) {
    for (const email of await departmentLeadEmails(client, department)) {
      const key = email.toLowerCase()
      if (!appealsByLeadEmail.has(key)) appealsByLeadEmail.set(key, skipped)
    }
  }

  for (const [email, decided] of appealsByLeadEmail) {
    const byEmployee = groupByEmployee(decided)
    const only = decided.length === 1 ? decided[0] : null
    await sendAttendanceMail({
      to: [email],
      subject: only
        ? `Attendance Appeal ${appealVerb(only)} — ${only.appeal_date} (${nameOf(only.user_id)})`
        : `Attendance Appeals Decided — ${countLabel(decided.length, "day")}, ${countLabel(byEmployee.size, "employee")}`,
      title: "Attendance Appeals Decided",
      message: `${countLabel(decided.length, "attendance appeal")} for ${countLabel(byEmployee.size, "employee")} ${decided.length === 1 ? "was" : "were"} decided since the last summary (sent ${formatTimestamp(new Date().toISOString())} WAT).`,
      sections: [...byEmployee].map(([userId, rows]) => ({
        title: `${nameOf(userId)} — ${countLabel(rows.length, "day")}`,
        details: rows.map((appeal) => {
          const actorId = appealActorId(appeal)
          const comment = appealComment(appeal)
          return {
            label: appeal.appeal_date,
            value: [
              appealVerb(appeal),
              appealTransition(appeal),
              actorId ? `by ${nameOf(actorId)}` : null,
              appeal.appeal_reason?.trim() ? `Reason: ${appeal.appeal_reason.trim()}` : null,
              comment ? `Comment: ${comment}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }
        }),
      })),
      ctaPath: "/admin/hr/attendance?tab=appeals",
    })
    emails += 1
  }

  return { appeals: appeals.length, emails }
}

export interface NotifyAttendanceInAppParams {
  affectedUserId: string
  actorId: string | null
  date: string
  fromStatus?: string | null
  toStatus?: string | null
  /** "created" for a new manual record, "updated" for an edit. */
  action: "created" | "updated"
  entityId?: string | null
}

/**
 * Internal (in-app) notification for a manual attendance alteration — no email. Emailing is
 * reserved for LWP/AWP appeal decisions; every other manual change only pings the employee in-app.
 * Best-effort: never throws.
 */
export async function notifyAttendanceInApp(client: NotifyClient, params: NotifyAttendanceInAppParams): Promise<void> {
  try {
    const statusText = statusLabel(params.toStatus)
    const message =
      params.action === "created"
        ? `Your attendance for ${params.date} was recorded as ${statusText} by the Admin and HR team.`
        : `Your attendance for ${params.date} was updated to ${statusText} by the Admin and HR team.`

    await client.rpc("create_notification", {
      p_user_id: params.affectedUserId,
      p_type: "system",
      p_category: "system",
      p_title: "Attendance Record Updated",
      p_message: message,
      p_priority: "normal",
      p_link_url: "/hr/attendance",
      p_actor_id: params.actorId,
      p_entity_type: "attendance_record",
      p_entity_id: params.entityId ?? null,
    })
  } catch (err) {
    log.error({ err: String(err) }, "Failed to create attendance in-app notification")
  }
}

export interface NotifyAppealSubmittedParams {
  /** Employee who raised the appeal. */
  appellantId: string
  /** Day appealed, YYYY-MM-DD. */
  date: string
  fromStatus: string
  requestedStatus: string
  reason: string
}

/**
 * Emails the appellant's department lead and the Admin & HR lead when an appeal is raised.
 * Until this, a new appeal only produced an in-app notification for the department lead, so an
 * appeal could sit unseen by anyone who did not open the app, and HR heard nothing until it was
 * decided. Same two gates as every other attendance email. Best-effort: never throws.
 */
export async function notifyAppealSubmittedMail(
  client: NotifyClient,
  params: NotifyAppealSubmittedParams
): Promise<void> {
  try {
    if (!(await isSystemNotificationChannelEnabled(client, "attendance", "email"))) return
    const policy = await loadAttendancePolicy(client)
    if (policy.emailNotificationsEnabled === false) return

    const { data: appellant } = await client
      .from("profiles")
      .select("id, full_name, first_name, last_name, department")
      .eq("id", params.appellantId)
      .maybeSingle<
        Pick<ProfileNameEmailRow, "id" | "full_name" | "first_name" | "last_name"> & {
          department: string | null
        }
      >()

    const appellantName = formatName(appellant)
    const department = appellant?.department ?? null
    const [deptLeadEmails, hrLeadEmails] = await Promise.all([
      department ? departmentLeadEmails(client, department) : Promise.resolve([] as string[]),
      resolveAdminHrLeadEmails(client),
    ])
    const recipients = Array.from(new Set([...deptLeadEmails, ...hrLeadEmails].map((email) => email.toLowerCase())))
    if (recipients.length === 0) return

    await sendAttendanceMail({
      to: recipients,
      subject: `Attendance Appeal Submitted — ${params.date} (${appellantName})`,
      title: "Attendance Appeal Submitted",
      message: `${appellantName} has appealed their attendance for ${params.date}. It is waiting for review on the Appeals tab of Attendance.`,
      detailsTitle: "Appeal Details",
      ctaPath: "/admin/hr/attendance?tab=appeals",
      details: [
        { label: "Employee", value: appellantName },
        { label: "Department", value: department || "N/A" },
        { label: "Date", value: params.date },
        { label: "Status", value: `${statusLabel(params.fromStatus)} → ${statusLabel(params.requestedStatus)}` },
        { label: "Reason", value: params.reason.trim() || "N/A" },
        { label: "Submitted", value: formatTimestamp(new Date().toISOString()) },
      ],
    })
  } catch (err) {
    log.error({ err: String(err) }, "Failed to send appeal submitted email")
  }
}
