import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { formatLeaveReference, leaveStageLabel, notifyUsers } from "@/lib/hr/leave-workflow"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { getRequestScope } from "@/lib/admin/api-scope"
import { toLocalISODate } from "@/lib/utils/date"

const log = logger("hr-leave-sla-reminders")

type SlaPolicyRow = {
  stage: string
  due_hours: number
  reminder_hours_before: number
  escalate_to_role?: string | null
}

type PendingLeaveRequestRow = {
  id: string
  user_id: string
  status: string
  start_date?: string | null
  end_date?: string | null
  days_count?: number | null
  leave_type_id?: string | null
  current_stage_code?: string | null
  current_approver_user_id?: string | null
  created_at: string
}

type ProfileIdRow = {
  id: string
}

type LapseProfileRow = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  company_email?: string | null
  department?: string | null
}

function displayName(profile: LapseProfileRow | undefined, fallback: string) {
  if (!profile) return fallback
  return (
    profile.full_name ||
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
    profile.company_email ||
    fallback
  )
}

const LEGACY_SLA_STAGE_MAP: Record<string, string> = {
  pending_reliever: "reliever_pending",
  pending_department_lead: "supervisor_pending",
  pending_admin_hr_lead: "hr_pending",
  pending_md: "hr_pending",
  pending_hcs: "hr_pending",
}

export async function PATCH() {
  const rl = await rateLimit("hr-leave-sla-reminders", { limit: 15, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const supabase = await createClient()
    const cronSecret = process.env.CRON_SECRET

    // Allow secure scheduled execution (e.g. Vercel Cron) via CRON secret.
    // If no valid cron token is provided, fall back to authenticated RBAC checks.
    const requestHeaders = await headers()
    const bearerToken = requestHeaders
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim()
    const isAuthorizedCron = Boolean(cronSecret && bearerToken && bearerToken === cronSecret)

    if (!isAuthorizedCron) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

      const reminderScope = await getRequestScope()
      if (!reminderScope?.isAdminLike || reminderScope.scopeMode === "lead") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Authorized above; read and write as the service role. The cron caller has
    // no session, so the cookie client would see zero leave requests under RLS.
    const db = getServiceRoleClientOrFallback(supabase)

    const { data: slaPolicies } = await db
      .from("approval_sla_policies")
      .select("stage, due_hours, reminder_hours_before, escalate_to_role")
      .eq("is_active", true)

    const policyMap = new Map(((slaPolicies || []) as SlaPolicyRow[]).map((item) => [item.stage, item] as const))

    const { data: pendingRequests, error } = await db
      .from("leave_requests")
      .select(
        "id, user_id, status, leave_type_id, start_date, end_date, days_count, current_stage_code, current_approver_user_id, created_at"
      )
      .in("status", ["pending", "pending_evidence"])

    if (error) return NextResponse.json({ error: "Failed to fetch pending leave requests" }, { status: 500 })

    const now = Date.now()
    const today = toLocalISODate()
    let remindersSent = 0

    for (const request of (pendingRequests || []) as PendingLeaveRequestRow[]) {
      // Industry-standard lapse behavior: unresolved requests are expired/cancelled
      // once leave start date is reached.
      if (request.start_date && request.start_date <= today) {
        const expiryReason = `Auto-lapsed: no final approval before leave start date (${request.start_date}).`

        const { error: expireError } = await db
          .from("leave_requests")
          .update({
            status: "cancelled",
            approval_stage: "cancelled",
            current_stage_code: "cancelled",
            rejected_reason: expiryReason,
            current_approver_user_id: null,
          })
          .eq("id", request.id)
          .in("status", ["pending", "pending_evidence"])

        if (!expireError) {
          const approverId = request.current_approver_user_id
          const [{ data: people }, { data: leaveType }] = await Promise.all([
            db
              .from("profiles")
              .select("id, full_name, first_name, last_name, company_email, department")
              .in("id", approverId ? [request.user_id, approverId] : [request.user_id]),
            request.leave_type_id
              ? db.from("leave_types").select("name").eq("id", request.leave_type_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ])
          const profiles = (people || []) as LapseProfileRow[]
          const requester = profiles.find((p) => p.id === request.user_id)
          const approver = approverId ? profiles.find((p) => p.id === approverId) : undefined
          const requesterName = displayName(requester, "Employee")
          const leaveTypeName = (leaveType as { name?: string } | null)?.name || "Leave"
          const stuckAt = leaveStageLabel(request.current_stage_code || "")
          const holder = approver ? `${displayName(approver, "the approver")} (${stuckAt})` : stuckAt
          const period = request.end_date ? `${request.start_date} to ${request.end_date}` : request.start_date
          const duration = request.days_count ? `${request.days_count} day(s)` : "-"

          await notifyUsers(db, {
            userIds: [request.user_id],
            title: "Your leave request lapsed",
            message: `Your ${leaveTypeName} request (${period}) was cancelled because it was still waiting on ${holder} when the leave start date arrived. It was not approved, so this time is not recorded as leave. If you still need it, submit a new request.`,
            linkUrl: "/hr/leave",
            entityId: request.id,
            emailEvent: "lapsed",
            badgeText: "Cancelled — Not Approved in Time",
            badgeVariant: "destructive",
            detailsTitle: "Lapsed Request",
            details: [
              { label: "Leave Type", value: leaveTypeName },
              { label: "Duration", value: duration },
              { label: "Period", value: period },
              { label: "Was Waiting On", value: holder },
              { label: "Status", value: "Cancelled automatically — submit a new request if still needed" },
            ],
            ctaLabel: "Submit a New Request",
          })
          remindersSent += 1

          if (approverId && approverId !== request.user_id) {
            await notifyUsers(db, {
              userIds: [approverId],
              title: "A leave request lapsed awaiting your action",
              message: `${requesterName}'s ${leaveTypeName} request (${period}) was cancelled because it reached its start date while still awaiting your review as ${stuckAt}. No action is needed now; ${requesterName} has been told to resubmit if the leave is still required.`,
              linkUrl: "/admin/hr/leave/approve",
              entityId: request.id,
              emailEvent: "lapsed",
              badgeText: "Lapsed at Your Stage",
              badgeVariant: "warning",
              detailsTitle: "Lapsed Request",
              details: [
                { label: "Employee", value: requesterName },
                { label: "Department", value: requester?.department || "-" },
                { label: "Leave Type", value: leaveTypeName },
                { label: "Duration", value: duration },
                { label: "Period", value: period },
                { label: "Pending Stage", value: stuckAt },
              ],
              ctaLabel: "Open Leave Approvals",
            })
            remindersSent += 1
          }
        }

        continue
      }

      if (!request.current_approver_user_id) continue

      const slaStage = LEGACY_SLA_STAGE_MAP[request.current_stage_code || ""] || "reliever_pending"
      const policy = policyMap.get(slaStage)
      if (!policy) continue

      const createdAt = new Date(request.created_at).getTime()
      const dueAt = createdAt + policy.due_hours * 60 * 60 * 1000
      const reminderAt = dueAt - policy.reminder_hours_before * 60 * 60 * 1000

      if (now >= reminderAt && now < dueAt) {
        await notifyUsers(db, {
          userIds: [request.current_approver_user_id],
          title: "Leave approval SLA reminder",
          message: `Leave request ${formatLeaveReference(request.id)} is due soon. Please review before SLA breach.`,
          linkUrl: "/hr/leave",
          entityId: request.id,
          emailEvent: "sla_reminder",
        })
        remindersSent += 1
      }

      if (now >= dueAt && policy.escalate_to_role) {
        const { data: escalatedUsers } = await db.from("profiles").select("id").eq("role", policy.escalate_to_role)

        const escalateRecipients = ((escalatedUsers || []) as ProfileIdRow[]).map((row) => row.id)
        if (escalateRecipients.length) {
          await notifyUsers(db, {
            userIds: escalateRecipients,
            title: "Leave approval SLA breached",
            message: `Leave request ${formatLeaveReference(request.id)} has breached SLA at the ${leaveStageLabel(request.current_stage_code || "")} stage.`,
            linkUrl: "/admin/hr/leave/approve",
            entityId: request.id,
            emailEvent: "sla_breached",
          })
          remindersSent += escalateRecipients.length
        }
      }
    }

    return NextResponse.json({ message: "SLA reminders processed", reminders_sent: remindersSent })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/hr/leave/sla/reminders:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export async function POST() {
  const rl = await rateLimit("hr-leave-sla-reminders", { limit: 15, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  return PATCH()
}
