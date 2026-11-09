import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { normalizeDepartmentName, DEPT_ADMIN_HR } from "@/shared/departments"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { ATTENDANCE_STATUS_LABELS, type UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { sendAttendanceMail, type AttendanceMailDetail } from "@/lib/hr/attendance-mailer"
import { isSystemNotificationChannelEnabled } from "@/lib/notifications/delivery-policy"
import { STUCK_AFTER_WORKING_DAYS, loadDepartmentLeads, workingDaysSince } from "@/lib/hr/attendance-appeals"
import { appealExpiryDate } from "@/lib/hr/appeal-expiry"
import { toLocalISODate } from "@/lib/utils/date"

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
  status: "approved" | "rejected" | "resolved" | "expired"
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
  if (appeal.status === "expired") return "Expired"
  return "Resolved"
}

function appealActorId(appeal: DecidedAppealRow): string | null {
  return appeal.overridden_by ?? appeal.admin_reviewed_by ?? appeal.lead_reviewed_by ?? appeal.reviewed_by
}

/** "Absent → Present", or the status the day kept when the appeal was turned down. */
function appealTransition(appeal: DecidedAppealRow): string {
  if (appeal.status === "rejected") return `Stays ${statusLabel(appeal.current_status)}`
  if (appeal.status === "expired") return `Stays ${statusLabel(appeal.current_status)} (not decided in time)`
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
 * Emails each employee one summary of their decided attendance appeals, never one email per
 * appeal. Leads hear about decisions only in their daily summary (sendAppealLeadDailySummary).
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
    .in("status", ["approved", "rejected", "resolved", "expired"])
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

/** An appeal as the leads' daily summary reads it: any status. */
type SummaryAppealRow = Omit<DecidedAppealRow, "status"> & {
  status: string
  stage: string | null
  created_at: string
  lead_reviewed_at: string | null
}

/** system_settings key holding { lastSentDate, lastSentAt } so the summary goes once a day. */
const LEAD_SUMMARY_SETTING_KEY = "attendance_appeal_lead_summary"

/** A missed run picks up from the last summary, but never reaches back further than this. */
const LEAD_SUMMARY_MAX_LOOKBACK_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

/** "2026-10-26, 2026-10-27", or "2026-10-06 to 2026-10-29 (18 days)" for a long run. */
function datesLabel(dates: string[]): string {
  const sorted = [...new Set(dates)].sort()
  if (sorted.length <= 4) return sorted.join(", ")
  return `${sorted[0]} to ${sorted[sorted.length - 1]} (${sorted.length} days)`
}

/**
 * One row per employee (per outcome, for decided appeals), so a range appeal reads as one line.
 */
function summaryDetails(
  rows: SummaryAppealRow[],
  nameOf: (id: string) => string,
  outcome?: (row: SummaryAppealRow) => string
): AttendanceMailDetail[] {
  const groups = new Map<string, SummaryAppealRow[]>()
  for (const row of rows) {
    const key = `${row.user_id}|${outcome ? outcome(row) : ""}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()].map((group) => {
    const first = group[0]
    const requested = [...new Set(group.map((row) => statusLabel(row.requested_status)))].join(" / ")
    return {
      label: nameOf(first.user_id),
      value: [
        datesLabel(group.map((row) => row.appeal_date)),
        outcome ? outcome(first) : `${statusLabel(first.current_status)} → ${requested}`,
        first.appeal_reason?.trim() ? `Reason: ${first.appeal_reason.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }
  })
}

function decidedOutcome(row: SummaryAppealRow): string {
  return appealVerb(row as DecidedAppealRow)
}

/**
 * The once-a-day appeal email for leads, sent by /api/cron/attendance/appeal-lead-summary at
 * 08:30 WAT. Leads get no other appeal email: it replaces the email per submitted appeal and the
 * lead copy of every decision.
 *
 * - Each Department Lead, per department they lead: appeals waiting for them, appeals raised
 *   since the last summary, and appeals decided since then (overrides that skipped them
 *   included), with a button to that department's Appeals tab.
 * - The Admin & HR lead: appeals waiting at the admin stages, plus everything raised and
 *   decided since the last summary across the company, with a button to the admin Appeals tab.
 *
 * A lead with nothing in any section gets no email. Once a day: the WAT date it went out is
 * recorded, so a rerun the same day sends nothing.
 */
export async function sendAppealLeadDailySummary(
  client: NotifyClient,
  now: Date = new Date()
): Promise<{ emails: number; skipped?: string }> {
  const today = toLocalISODate(now)
  const { data: setting, error: settingError } = await client
    .from("system_settings")
    .select("value")
    .eq("key", LEAD_SUMMARY_SETTING_KEY)
    .maybeSingle<{ value: { lastSentDate?: string; lastSentAt?: string } | null }>()
  if (settingError) throw new Error(`Failed to read ${LEAD_SUMMARY_SETTING_KEY}: ${settingError.message}`)
  const state = setting?.value ?? {}
  if (state.lastSentDate === today) return { emails: 0, skipped: "already_sent" }

  const floor = now.getTime() - LEAD_SUMMARY_MAX_LOOKBACK_DAYS * DAY_MS
  const lastSent = state.lastSentAt ? new Date(state.lastSentAt).getTime() : NaN
  const since = new Date(Number.isNaN(lastSent) ? now.getTime() - DAY_MS : Math.max(lastSent, floor)).toISOString()

  const recordSent = async () => {
    const { error } = await client.from("system_settings").upsert(
      {
        key: LEAD_SUMMARY_SETTING_KEY,
        value: { lastSentDate: today, lastSentAt: now.toISOString() },
        description: "Last daily attendance appeal summary sent to leads.",
      },
      { onConflict: "key" }
    )
    if (error) log.error({ err: error.message }, "Could not record the appeal lead summary date")
  }

  if (!(await isSystemNotificationChannelEnabled(client, "attendance", "email"))) {
    await recordSent()
    return { emails: 0, skipped: "email_disabled" }
  }
  const policy = await loadAttendancePolicy(client)
  if (policy.emailNotificationsEnabled === false) {
    await recordSent()
    return { emails: 0, skipped: "email_disabled" }
  }

  const { data: rows, error } = await client
    .from("attendance_appeals")
    .select(`${DECIDED_APPEAL_COLUMNS}, stage, created_at, lead_reviewed_at`)
    .or(`status.eq.pending,created_at.gte.${since},updated_at.gte.${since}`)
    .order("appeal_date", { ascending: true })
    .returns<SummaryAppealRow[]>()
  if (error) throw new Error(`Failed to load appeals for the lead summary: ${error.message}`)
  const appeals = rows ?? []

  const personIds = new Set<string>()
  for (const appeal of appeals) {
    personIds.add(appeal.user_id)
    const actorId = appealActorId(appeal as DecidedAppealRow)
    if (actorId) personIds.add(actorId)
  }
  const leads = await loadDepartmentLeads(client)
  for (const ids of leads.idsByDepartment.values()) for (const id of ids) personIds.add(id)

  const [{ data: people }, { data: departments }] = await Promise.all([
    client
      .from("profiles")
      .select("id, full_name, first_name, last_name, company_email, additional_email, department")
      .in("id", [...personIds])
      .returns<Array<ProfileNameEmailRow & { department: string | null }>>(),
    client.from("departments").select("id, name").returns<Array<{ id: string; name: string }>>(),
  ])
  const profileMap = new Map((people ?? []).map((row) => [row.id, row]))
  const nameOf = (id: string) => formatName(profileMap.get(id))
  const departmentIdByName = new Map(
    (departments ?? []).map((dept) => [normalizeDepartmentName(dept.name), dept.id] as const)
  )
  const departmentOf = (appeal: SummaryAppealRow) =>
    normalizeDepartmentName(profileMap.get(appeal.user_id)?.department ?? "")

  const isRaised = (appeal: SummaryAppealRow) => appeal.created_at >= since
  const isDecided = (appeal: SummaryAppealRow) => appeal.status !== "pending" && appeal.updated_at >= since
  const adminHr = normalizeDepartmentName(ADMIN_HR_DEPARTMENT)

  const sendSummary = async (params: {
    to: string[]
    scopeLabel: string
    waiting: SummaryAppealRow[]
    pool: SummaryAppealRow[]
    note?: string
    ctaPath: string
  }) => {
    const raised = params.pool.filter(isRaised)
    const decided = params.pool.filter(isDecided)
    if (params.waiting.length + raised.length + decided.length === 0 || params.to.length === 0) return 0

    // Overdue: with the approver for STUCK_AFTER_WORKING_DAYS working days or more.
    // Expiring: the deadline falls within a week; after it the appeal expires, the day stays
    // as recorded and the employee is told.
    const overdue = params.waiting.filter(
      (row) =>
        workingDaysSince(
          row.stage === "pending_lead" ? row.created_at : (row.lead_reviewed_at ?? row.created_at),
          now
        ) >= STUCK_AFTER_WORKING_DAYS
    )
    const weekAhead = toLocalISODate(new Date(now.getTime() + 7 * DAY_MS))
    const expiring = params.waiting.filter((row) => {
      const deadline = appealExpiryDate(row.appeal_date, row.requested_status ?? "")
      return deadline >= today && deadline <= weekAhead
    })
    const expiresOutcome = (row: SummaryAppealRow) =>
      `Expires ${appealExpiryDate(row.appeal_date, row.requested_status ?? "")}`

    const sections = [
      {
        title: `Overdue, ${STUCK_AFTER_WORKING_DAYS}+ working days (${overdue.length})`,
        rows: overdue,
        outcome: undefined,
      },
      { title: `Expiring this week (${expiring.length})`, rows: expiring, outcome: expiresOutcome },
      { title: `Waiting for you (${params.waiting.length})`, rows: params.waiting, outcome: undefined },
      { title: `Raised since the last summary (${raised.length})`, rows: raised, outcome: undefined },
      { title: `Decided since the last summary (${decided.length})`, rows: decided, outcome: decidedOutcome },
    ]
      .filter((section) => section.rows.length > 0)
      .map((section) => ({ title: section.title, details: summaryDetails(section.rows, nameOf, section.outcome) }))

    await sendAttendanceMail({
      to: params.to,
      subject:
        params.waiting.length > 0
          ? `Attendance Appeals — ${countLabel(params.waiting.length, "day")} waiting for you (${params.scopeLabel})`
          : `Attendance Appeals Summary (${params.scopeLabel})`,
      title: "Attendance Appeals Summary",
      message:
        (params.waiting.length > 0
          ? `${countLabel(params.waiting.length, "appealed day")} ${params.waiting.length === 1 ? "is" : "are"} waiting for your review.`
          : "Nothing is waiting for your review.") +
        ` Below is what was raised and decided since the last summary (${formatTimestamp(since)} WAT).` +
        (params.note ? ` ${params.note}` : ""),
      sections,
      ctaPath: params.ctaPath,
      ctaLabel: "Review Appeals",
    })
    return 1
  }

  let emails = 0

  // ── Department Leads, one email per department they lead ──
  for (const [department, leadIds] of leads.idsByDepartment) {
    const key = normalizeDepartmentName(department)
    if (key === adminHr) continue // Admin & HR's own appeals are in the Admin & HR lead's email.
    const pool = appeals.filter((appeal) => departmentOf(appeal) === key)
    const waiting = pool.filter((appeal) => appeal.status === "pending" && appeal.stage === "pending_lead")
    const departmentId = departmentIdByName.get(key)
    const to = [...new Set(leadIds)].flatMap((id) => collectEmails(profileMap.get(id)))
    emails += await sendSummary({
      to,
      scopeLabel: department,
      waiting,
      pool,
      ctaPath: departmentId ? `/dept/${departmentId}/hr/attendance?tab=appeals` : "/hr/attendance",
    })
  }

  // ── Admin & HR lead, one email covering the company ──
  const withLeads = appeals.filter(
    (appeal) => appeal.status === "pending" && appeal.stage === "pending_lead" && departmentOf(appeal) !== adminHr
  )
  emails += await sendSummary({
    to: await resolveAdminHrLeadEmails(client),
    scopeLabel: "all departments",
    waiting: appeals.filter(
      (appeal) =>
        appeal.status === "pending" &&
        (appeal.stage === "pending_admin" ||
          appeal.stage === "pending_hr_lead" ||
          (appeal.stage === "pending_lead" && departmentOf(appeal) === adminHr))
    ),
    pool: appeals,
    note:
      withLeads.length > 0
        ? `${countLabel(withLeads.length, "more day")} ${withLeads.length === 1 ? "is" : "are"} still with Department Leads.`
        : undefined,
    ctaPath: "/admin/hr/attendance?tab=appeals",
  })

  await recordSent()
  return { emails }
}
