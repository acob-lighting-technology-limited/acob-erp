/**
 * The deadline digest: one email to one person, listing the overdue work they
 * can still do something about.
 *
 * A digest rather than one mail per task, deliberately. A lead with ten
 * at-risk tasks would otherwise get ten emails in one night and read none of
 * them, and the decision they have to make is the same for all ten.
 *
 * It exists because the in-app notification is not reaching anyone: task
 * notifications have never been emailed, and not one member of staff has a
 * push subscription, so a warning that a task is about to be recorded as
 * failed lives only in a bell icon nobody opens. The first they would learn of
 * it is their KPI.
 *
 * The subject carries the count and the date to act by - not the date the task
 * fails. Those are different days: a task fails at midnight entering the fail
 * date, so the last day anyone can do anything is the working day before it.
 * Naming the fail date invited people to deal with it that morning, by which
 * point it had already gone.
 */

import { escapeHtml } from "@/lib/email-templates/utils"

export type DigestTask = {
  /** Human-readable reference, e.g. "TSK-000042". Null on older rows. */
  reference?: string | null
  assignee: string
  /** YYYY-MM-DD; rendered human-readably. */
  deadline: string
  daysLate: number
  weight: number
  status: string
  title: string
  project?: string | null
}

export type DigestInput = {
  /** First name, for the greeting. */
  recipientName: string
  /** Last day to act, e.g. "Mon 21 Sep" - the working day before the failure. */
  actByLabel: string
  /** Working days left, counting the day the mail arrives. */
  workingDaysLeft: number
  tasks: DigestTask[]
  /** True when every task listed is the recipient's own work. */
  ownWorkOnly: boolean
  /** The recipient's own department, shown in the footer and used as the sender. */
  department: string
  /** Monitored mailbox a reply reaches, named in the footer so it is not a dead end. */
  replyToLabel: string
}

const GREEN = "#16a34a"
const DARK_LOCK =
  "background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;"

function bar(content: string, padding: string): string {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" ' +
    `style="${DARK_LOCK}border-top:3px solid ${GREEN};border-bottom:3px solid ${GREEN};mso-line-height-rule:exactly;">` +
    `<tr><td align="center" style="padding:${padding};${DARK_LOCK}font-size:11px;color:#d1d5db;">${content}</td></tr></table>`
  )
}

/** "2026-09-15" to "Tue 15 Sep". Dates people read, not dates machines sort by. */
function humanDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
}

function lateLabel(days: number): string {
  return days === 1 ? "1 day late" : `${days} days late`
}

/** A single task, for the one-task case: a table of one row reads as a form. */
function block(task: DigestTask): string {
  return (
    '<div style="border:1px solid #e5e7eb;border-left:4px solid #991b1b;border-radius:4px;padding:14px 16px;margin:20px 0;">' +
    (task.reference
      ? `<div style="font-size:12px;font-weight:600;color:#6b7280;letter-spacing:0.4px;margin-bottom:4px;">${escapeHtml(task.reference)}</div>`
      : "") +
    `<div style="font-size:15px;font-weight:600;color:#111827;line-height:1.4;">${escapeHtml(task.title)}</div>` +
    (task.project
      ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(task.project)}</div>`
      : "") +
    '<div style="font-size:13px;color:#374151;margin-top:8px;">' +
    `Due <strong>${escapeHtml(humanDate(task.deadline))}</strong> &middot; ` +
    `<span style="color:#991b1b;">${escapeHtml(lateLabel(task.daysLate))}</span> &middot; ` +
    `weight ${task.weight}` +
    "</div></div>"
  )
}

function headerCell(label: string): string {
  return `<th align="left" style="padding:8px 10px;font-size:12px;color:#374151;font-weight:600;">${escapeHtml(label)}</th>`
}

function row(task: DigestTask, showAssignee: boolean): string {
  const title =
    `<span style="color:#111827;">${escapeHtml(task.title)}</span>` +
    (task.project ? `<br><span style="color:#6b7280;font-size:12px;">${escapeHtml(task.project)}</span>` : "")
  return (
    '<tr style="border-bottom:1px solid #e5e7eb;">' +
    `<td style="padding:8px 10px;font-size:12px;color:#6b7280;white-space:nowrap;">${escapeHtml(task.reference || "")}</td>` +
    (showAssignee
      ? `<td style="padding:8px 10px;font-size:13px;color:#111827;white-space:nowrap;">${escapeHtml(task.assignee)}</td>`
      : "") +
    `<td style="padding:8px 10px;font-size:13px;color:#374151;white-space:nowrap;">${escapeHtml(humanDate(task.deadline))}</td>` +
    `<td style="padding:8px 10px;font-size:13px;color:#991b1b;white-space:nowrap;">${escapeHtml(lateLabel(task.daysLate))}</td>` +
    `<td style="padding:8px 10px;font-size:13px;color:#374151;text-align:center;">${task.weight}</td>` +
    `<td style="padding:8px 10px;font-size:13px;">${title}</td>` +
    "</tr>"
  )
}

function button(href: string, label: string): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr>' +
    `<td bgcolor="${GREEN}" style="border-radius:4px;">` +
    `<a href="${href}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>` +
    "</td></tr></table>"
  )
}

export function renderTaskOverdueDigest(input: DigestInput): { subject: string; html: string } {
  const n = input.tasks.length
  const subject = `${n} overdue task${n === 1 ? "" : "s"} — act by ${input.actByLabel}`

  const days = input.workingDaysLeft
  const daysPhrase = days <= 1 ? "today is the last day" : `you have ${days} working days`

  const heading = input.ownWorkOnly
    ? n === 1
      ? "Your task is past its deadline"
      : `${n} of your tasks are past their deadline`
    : n === 1
      ? "A task you oversee is past its deadline"
      : `${n} tasks you oversee are past their deadline`

  const intro = input.ownWorkOnly
    ? `${n === 1 ? "It is" : "They are"} still open, and ${daysPhrase} to act. ` +
      `After <strong>${escapeHtml(input.actByLabel)}</strong>, ${n === 1 ? "it will be" : "they will be"} recorded as <strong>Failed</strong>.`
    : `${n === 1 ? "It is" : "They are"} still open and only you can close ${n === 1 ? "it" : "them"} out. ` +
      `${daysPhrase.charAt(0).toUpperCase()}${daysPhrase.slice(1)} to act — after <strong>${escapeHtml(input.actByLabel)}</strong>, ` +
      `${n === 1 ? "it will be" : "they will be"} recorded as <strong>Failed</strong>.`

  const options = input.ownWorkOnly
    ? [
        [
          "Submit what you have",
          "Part-done work still gets rated, and even a 1 earns marks. A task that expires earns none.",
        ],
        ["Ask for more time", "Buys time, but it scores zero until the work is finished and rated."],
        ["Do nothing", "Recorded as Failed — zero at full weight, and you cannot reverse it yourself."],
      ]
    : [
        [
          "Cancel or reassign",
          "The task leaves that person's score completely. Use it where the work was never theirs, is no longer needed, or has moved on.",
        ],
        [
          "Ask them to submit what they have",
          "Part-done work still gets rated, and even a 1 earns marks. A task that expires earns none.",
        ],
        ["Extend the deadline", "Buys time, but it scores zero until the work is finished and rated."],
        ["Do nothing", "Recorded as Failed — zero at full weight, and they cannot reverse it themselves."],
      ]

  const showAssignee = !input.ownWorkOnly
  const body =
    n === 1 && input.ownWorkOnly
      ? block(input.tasks[0])
      : '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:20px 0;">' +
        `<tr style="background:#f3f4f6;">${headerCell("Ref")}${showAssignee ? headerCell("Who") : ""}${headerCell("Due")}${headerCell("Late by")}` +
        '<th align="center" style="padding:8px 10px;font-size:12px;color:#374151;font-weight:600;">Wt</th>' +
        `${headerCell("Task")}</tr>` +
        input.tasks.map((t) => row(t, showAssignee)).join("") +
        "</table>"

  const html =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#fff;font-family:Segoe UI, Tahoma, Geneva, Verdana, sans-serif;">' +
    '<div style="max-width:640px;margin:0 auto;">' +
    bar(
      '<img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" height="60" alt="ACOB Lighting">',
      "20px 0"
    ) +
    '<div style="padding:32px 28px;">' +
    `<div style="font-size:20px;font-weight:700;color:#111827;margin:0 0 14px;line-height:1.3;">${escapeHtml(heading)}</div>` +
    `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">Hello ${escapeHtml(input.recipientName)},</p>` +
    `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0;">${intro}</p>` +
    body +
    '<div style="font-size:14px;font-weight:700;color:#111827;margin:22px 0 8px;">What you can do</div>' +
    '<ul style="font-size:14px;color:#374151;line-height:1.6;padding-left:18px;margin:0;">' +
    options
      .map(([label, detail]) => `<li><strong>${escapeHtml(label)}</strong> — ${escapeHtml(detail)}</li>`)
      .join("") +
    "</ul>" +
    button("https://matrix.acoblighting.com/tasks", n === 1 ? "Open the task" : "Open Tasks") +
    '<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">' +
    "A failed task counts as zero at full weight towards the KPI, which is 70% of the appraisal. " +
    "Work that is cancelled or reassigned does not count at all." +
    "</p>" +
    "</div>" +
    bar(
      `<span style="color:#d1d5db;">${escapeHtml(input.department)}</span><br>` +
        '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>' +
        `<span style="color:${GREEN};font-weight:600;">Performance Management System</span><br><br>` +
        '<i style="color:#9ca3af;">This is an automated notification, but replies are read &mdash; reply to this ' +
        `email and it reaches ${escapeHtml(input.replyToLabel)}.</i>`,
      "20px"
    ) +
    "</div></body></html>"

  return { subject, html }
}
