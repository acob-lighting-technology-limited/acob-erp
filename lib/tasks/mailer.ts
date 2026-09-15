import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { escapeHtml } from "@/lib/email-templates/utils"
import { logger } from "@/lib/logger"
import { resolveChannelEligibleUserIds } from "@/lib/notifications/delivery-policy"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { ORG_EMAIL_SENDERS, TASKS_LIST_ID, orgDepartmentSenderBare } from "@/lib/org-config"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

const log = logger("tasks-mailer")

/**
 * Only the task events where the recipient has to act are emailed. Status
 * changes they merely need to know about (updated, completed, blocked) stay
 * in-app, so the inbox stream stays worth reading.
 */
export type TaskEmailKind = "assigned" | "awaiting_review" | "due_soon" | "needs_rating"

interface TaskEmailInput {
  kind: TaskEmailKind
  taskId: string
  recipientIds: string[]
  /**
   * The person a reply should reach — the other human in the exchange. Task
   * mail is sent from the shared notifications mailbox, which nobody reads.
   */
  replyToUserId?: string | null
  /** due_soon: days until the deadline (0 = today). */
  daysRemaining?: number
  /** needs_rating: days the submission has been waiting. */
  waitingDays?: number
}

interface TaskRow {
  id: string
  title: string | null
  work_item_number: string | null
  department: string | null
  priority: string | null
  due_date: string | null
  task_end_date: string | null
  assigned_by: string | null
  assigned_to: string | null
}

interface PersonRow {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
  company_email: string | null
  additional_email: string | null
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://matrix.acoblighting.com"

function fullName(person: PersonRow | undefined): string {
  if (!person) return ""
  return [person.first_name, person.last_name].filter(Boolean).join(" ").trim()
}

function primaryEmail(person: PersonRow | undefined): string | null {
  const email = (person?.company_email || person?.additional_email || "").trim().toLowerCase()
  return email.includes("@") ? email : null
}

function whenLabel(days: number): string {
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`
}

/**
 * Tasks are issued by a department, so the department is who is speaking.
 * Older tasks predate the department column; the assigner's department stands
 * in, and the company identity is the last resort.
 */
function senderFor(task: TaskRow, assigner: PersonRow | undefined): string {
  const department = (task.department || assigner?.department || "").replace(/^ACOB\s+/i, "").trim()
  return department ? orgDepartmentSenderBare(department) : ORG_EMAIL_SENDERS.system
}

function buildContent(input: TaskEmailInput, task: TaskRow, people: Map<string, PersonRow>) {
  const title = task.title || "Untitled task"
  const assigner = fullName(task.assigned_by ? people.get(task.assigned_by) : undefined)
  const assignee = fullName(task.assigned_to ? people.get(task.assigned_to) : undefined)

  switch (input.kind) {
    case "assigned":
      return {
        subject: `Task assigned: ${title}`,
        heading: "A task has been assigned to you",
        intro: assigner ? `${assigner} assigned you a task.` : "You have been assigned a task.",
        ctaLabel: "Open my tasks",
        ctaPath: "/tasks",
      }
    case "awaiting_review":
      return {
        subject: `Task awaiting your review: ${title}`,
        heading: "A task is waiting for your review",
        intro: `${assignee || "The assignee"} has submitted this task. It needs your approval and rating.`,
        ctaLabel: "Review task",
        ctaPath: "/admin/tasks",
      }
    case "due_soon": {
      const when = whenLabel(input.daysRemaining ?? 0)
      return {
        subject: `Task due ${when}: ${title}`,
        heading: `Your task is due ${when}`,
        intro: "This task is not finished yet. Submit it before the deadline, or speak to whoever assigned it.",
        ctaLabel: "Open my tasks",
        ctaPath: "/tasks",
      }
    }
    case "needs_rating": {
      const days = input.waitingDays ?? 0
      return {
        subject: `Task still waiting for your rating: ${title}`,
        heading: "A submitted task is still unrated",
        intro: `${assignee || "The assignee"} submitted this task ${days} day${days === 1 ? "" : "s"} ago. It stays out of their KPI until you rate it.`,
        ctaLabel: "Rate task",
        ctaPath: "/admin/tasks",
      }
    }
  }
}

function detailRow(label: string, value: string, last = false): string {
  const border = last ? "" : "border-bottom: 1px solid #e5e7eb;"
  return (
    "<tr>" +
    `<td style="width: 35%; color: #64748b; font-weight: 500; border-right: 1px solid #e5e7eb; padding: 12px 18px; font-size: 13px; ${border}">${escapeHtml(label)}</td>` +
    `<td style="color: #0f172a; font-weight: 600; padding: 12px 18px; font-size: 13px; ${border}">${escapeHtml(value)}</td>` +
    "</tr>"
  )
}

function buildHtml(params: {
  recipientFirstName: string
  heading: string
  intro: string
  ctaLabel: string
  ctaPath: string
  details: Array<[string, string]>
  departmentLabel: string
}): string {
  const rows = params.details.map(([label, value], index) => detailRow(label, value, index === params.details.length - 1))
  const band =
    'bgcolor="#000000" style="background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;"'

  return (
    "<!DOCTYPE html>" +
    '<html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    `<title>${escapeHtml(params.heading)}</title>` +
    '<style>body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }</style>' +
    "</head><body>" +
    '<div style="max-width: 600px; margin: 0 auto; overflow: hidden;">' +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${band}>` +
    '<tr><td align="center" style="padding:20px 0;">' +
    '<img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" height="65" alt="ACOB Lighting">' +
    "</td></tr></table>" +
    '<div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px;">' +
    `<div style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px;">${escapeHtml(params.heading)}</div>` +
    `<p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0;">Hi ${escapeHtml(params.recipientFirstName || "there")},</p>` +
    `<p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0;">${escapeHtml(params.intro)}</p>` +
    '<div style="margin-top: 22px; border: 1px solid #e5e7eb; overflow: hidden; background: #fbfbfb; border-radius: 6px;">' +
    '<div style="padding: 12px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #e5e7eb; background: #f8fafc; color: #64748b;">Task Details</div>' +
    `<table style="width: 100%; border-collapse: collapse;">${rows.join("")}</table>` +
    "</div>" +
    '<div style="text-align: center; margin: 28px 0;">' +
    `<a href="${SITE_URL}${params.ctaPath}" style="display: inline-block; background: #166534; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px;">${escapeHtml(params.ctaLabel)}</a>` +
    "</div></div>" +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${band}>` +
    '<tr><td align="center" style="padding:20px;font-size:11px;color:#d1d5db;">' +
    '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>' +
    `<span style="color:#16a34a;font-weight:600;">${escapeHtml(params.departmentLabel)}</span>` +
    "<br><br>" +
    '<i style="color:#9ca3af;">This is an automated notification. Replying reaches the person involved in this task.</i>' +
    "</td></tr></table>" +
    "</div></body></html>"
  )
}

/**
 * Emails the recipients of a task event, alongside the in-app notification
 * the caller already creates. Never throws: a mail failure must not undo or
 * fail the task operation that triggered it.
 */
export async function sendTaskEmail(supabaseClient: SupabaseClient, input: TaskEmailInput): Promise<void> {
  try {
    // Profiles are RLS-scoped to the viewer's own row; recipients are other people.
    const supabase = getServiceRoleClientOrFallback(supabaseClient)

    const eligibleIds = await resolveChannelEligibleUserIds(supabase, {
      userIds: input.recipientIds,
      notificationKey: "tasks",
      channel: "email",
    })
    if (!eligibleIds.length) return

    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, work_item_number, department, priority, due_date, task_end_date, assigned_by, assigned_to")
      .eq("id", input.taskId)
      .maybeSingle<TaskRow>()
    if (!task) return

    const personIds = Array.from(
      new Set(
        [...eligibleIds, task.assigned_by, task.assigned_to, input.replyToUserId].filter(Boolean) as string[]
      )
    )
    const { data: personRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, department, company_email, additional_email")
      .in("id", personIds)
      .returns<PersonRow[]>()
    const people = new Map((personRows || []).map((person) => [person.id, person]))

    const assigner = task.assigned_by ? people.get(task.assigned_by) : undefined
    const from = senderFor(task, assigner)
    const departmentLabel = (task.department || assigner?.department || "Task Management").replace(/^ACOB\s+/i, "")
    const replyTo = input.replyToUserId ? primaryEmail(people.get(input.replyToUserId)) : null
    const content = buildContent(input, task, people)

    const deadline = (task.task_end_date || task.due_date || "").slice(0, 10)
    const details: Array<[string, string]> = [
      ["Task", task.title || "Untitled task"],
      ...(task.work_item_number ? ([["Reference", task.work_item_number]] as Array<[string, string]>) : []),
      ["Department", departmentLabel],
      ["Priority", task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "Normal"],
      ["Deadline", deadline || "Not set"],
      ["Assigned by", fullName(assigner) || "—"],
    ]
    if (input.kind === "awaiting_review" || input.kind === "needs_rating") {
      details.push(["Assignee", fullName(task.assigned_to ? people.get(task.assigned_to) : undefined) || "—"])
    }

    for (const recipientId of eligibleIds) {
      const recipient = people.get(recipientId)
      const to = primaryEmail(recipient)
      if (!to) continue

      const result = await sendNotificationEmailWithRetry({
        from,
        to: [to],
        subject: content.subject,
        listId: TASKS_LIST_ID,
        ...(replyTo && replyTo !== to ? { replyTo } : {}),
        html: buildHtml({
          recipientFirstName: recipient?.first_name || "",
          heading: content.heading,
          intro: content.intro,
          ctaLabel: content.ctaLabel,
          ctaPath: content.ctaPath,
          details,
          departmentLabel,
        }),
      })

      if (!result.sent && result.reason !== "missing_resend_key") {
        log.error(
          { taskId: task.id, kind: input.kind, recipientId, reason: result.reason, err: result.error },
          "Task email failed"
        )
      }
    }
  } catch (error) {
    log.error({ err: String(error), taskId: input.taskId, kind: input.kind }, "Task email dispatch failed")
  }
}
