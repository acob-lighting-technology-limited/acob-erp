/**
 * One-off: email the people who can still act on the overdue backlog.
 *
 * Automatic failing began on TASK_ENFORCEMENT_START, and the work that was
 * already overdue before then is being warned rather than failed outright. The
 * warnings are in-app only — task notifications have never been emailed, and
 * nobody has a push subscription — so without this nobody finds out until the
 * tasks are already recorded as failed.
 *
 * Dry run by default; prints exactly who would receive what.
 *
 *   npx tsx scripts/send-overdue-digest.ts                     # dry run, everyone
 *   npx tsx scripts/send-overdue-digest.ts --only a@b.com      # dry run, one person
 *   npx tsx scripts/send-overdue-digest.ts --only a@b.com --send
 *   npx tsx scripts/send-overdue-digest.ts --send              # the real thing
 *
 * --self <email> ignores the routing and builds one digest of that person's own
 * overdue work, addressed to them. Used to check the mail before anyone else
 * receives it: it can only ever reach the address you name.
 */

import fs from "node:fs"
import path from "node:path"
import type { DigestTask } from "@/lib/email-templates/task-overdue-digest"

// The gateway reads Resend config from the environment at import time, and a
// standalone script gets none of Next.js's env loading, so .env.local goes in
// first and the gateway is imported dynamically afterwards.
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue
  const i = line.indexOf("=")
  const key = line.slice(0, i).trim()
  if (!process.env[key])
    process.env[key] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "")
}

const FAIL_DATE_ISO = "2026-09-22"

/** Fallback when a recipient has no department recorded. */
const FALLBACK_DEPARTMENT = "Admin and HR"

/**
 * Shared mailboxes, so a reply reaches the department rather than one person.
 * Departments without one fall back to their head's own address, the way the
 * broadcast mailer resolves it, and finally to HR.
 */
const DEPARTMENT_MAILBOXES: Record<string, string> = {
  "IT and Communications": "ict",
  "Admin and HR": "hradmin",
  Accounts: "accounts",
  Finance: "accounts",
}

/** Strip an "ACOB " prefix the way the broadcast sender does, so the label is
 *  not doubled up by orgDepartmentSenderBare. */
function departmentLabel(input: string | null | undefined): string {
  return (input || "").replace(/^ACOB\s+/i, "").trim() || FALLBACK_DEPARTMENT
}

async function main() {
  const args = process.argv.slice(2)
  const send = args.includes("--send")
  const onlyIndex = args.indexOf("--only")
  const only = onlyIndex >= 0 ? args[onlyIndex + 1]?.toLowerCase() : null
  // Send a real recipient's digest to a different address, to eyeball the
  // layout before the actual people receive it.
  const redirectIndex = args.indexOf("--redirect")
  const redirect = redirectIndex >= 0 ? args[redirectIndex + 1] : null
  const selfIndex = args.indexOf("--self")
  const self = selfIndex >= 0 ? args[selfIndex + 1]?.toLowerCase() : null

  const { default: pg } = await import("pg")
  const { renderTaskOverdueDigest } = await import("@/lib/email-templates/task-overdue-digest")
  const { sendNotificationEmailWithRetry } = await import("@/lib/notifications/email-gateway")
  const { orgDepartmentSenderBare, ORG_MAIL_ROUTING, ORG_PRIMARY_DOMAIN, ORG_HR_EMAIL } = await import(
    "@/lib/org-config"
  )
  const { TASK_ENFORCEMENT_START, graceStartFor, isGraceExhausted, nonWorkingDaysFor, taskDeadline } = await import(
    "@/lib/tasks/overdue"
  )
  const { eachIsoDate, isWorkingDay, addIsoDays } = await import("@/lib/hr/leave-days")
  const { toLocalISODate } = await import("@/lib/utils/date")

  const url = (process.env.SUPABASE_POSTGRES_URL_NON_POOLING || process.env.SUPABASE_POSTGRES_URL || "").replace(
    /[?&]sslmode=[^&]*/g,
    ""
  )
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const { rows: leadRows } = await c.query(
    `select id, first_name||' '||last_name as name, department, lead_departments
       from public.profiles where is_department_lead = true`
  )
  // department -> head's own address, for departments with no shared mailbox
  const { rows: headRows } = await c.query(
    `select d.name, p.company_email
       from public.departments d join public.profiles p on p.id = d.department_head_id`
  )
  const headEmailByDept = new Map<string, string>(
    (headRows as Array<{ name: string; company_email: string | null }>)
      .filter((r) => r.company_email)
      .map((r) => [r.name, (r.company_email as string).toLowerCase()])
  )
  const replyToFor = (dept: string): string => {
    const box = DEPARTMENT_MAILBOXES[dept]
    if (box) return `${box}@${ORG_PRIMARY_DOMAIN}`
    return headEmailByDept.get(dept) || ORG_HR_EMAIL
  }

  const { rows: deptRows } = await c.query(`select id, department from public.profiles`)
  const deptById = new Map<string, string>(
    (deptRows as Array<{ id: string; department: string | null }>).map((r) => [r.id, departmentLabel(r.department)])
  )
  const leadByDept = new Map<string, Array<{ id: string; name: string }>>()
  for (const l of leadRows as Array<{
    id: string
    name: string
    department: string | null
    lead_departments: string[] | null
  }>) {
    for (const d of new Set([l.department, ...(l.lead_departments ?? [])].filter(Boolean) as string[])) {
      const b = leadByDept.get(d) ?? []
      b.push({ id: l.id, name: l.name })
      leadByDept.set(d, b)
    }
  }

  const { rows: tasks } = await c.query(
    `select t.id, t.title, t.status, t.assigned_to, t.assigned_by, t.weight, t.department, t.work_item_number,
            to_char(t.due_date,'YYYY-MM-DD') as due_date,
            to_char(t.task_end_date,'YYYY-MM-DD') as task_end_date,
            coalesce(a.first_name||' '||a.last_name,'(unassigned)') as assignee,
            b.id as assigner_id, b.first_name||' '||b.last_name as assigner,
            pm.id as pm_id, pm.first_name||' '||pm.last_name as pm_name,
            coalesce(p.project_name,'') as project
       from public.tasks t
       left join public.profiles a on a.id=t.assigned_to
       left join public.profiles b on b.id=t.assigned_by
       left join public.projects p on p.id=t.project_id
       left join public.profiles pm on pm.id=p.project_manager_id
      where t.status in ('pending','in_progress','unable_to_complete') and t.is_archived=false
        and coalesce(t.task_end_date,t.due_date) < $1::date`,
    [TASK_ENFORCEMENT_START]
  )

  const { rows: hol } = await c.query(`select to_char(holiday_date,'YYYY-MM-DD') as d from public.holiday_calendar`)
  const holidays = new Set<string>(hol.map((r: { d: string }) => r.d))
  const { rows: leave } = await c.query(
    `select user_id, to_char(start_date,'YYYY-MM-DD') as s, to_char(end_date,'YYYY-MM-DD') as e
       from public.leave_requests where status='approved'`
  )
  const leaveByUser = new Map<string, Set<string>>()
  for (const r of leave as Array<{ user_id: string; s: string; e: string }>) {
    const set = leaveByUser.get(r.user_id) ?? new Set<string>()
    for (const iso of eachIsoDate(r.s, r.e)) set.add(iso)
    leaveByUser.set(r.user_id, set)
  }

  // The last day anyone can act is the working day BEFORE the failure: a task
  // fails at midnight entering FAIL_DATE_ISO, so naming that date in the mail
  // would invite people to deal with it the morning it had already gone.
  let actByIso = addIsoDays(FAIL_DATE_ISO, -1)
  let guard = 0
  while (!isWorkingDay(actByIso, holidays) && guard < 30) {
    actByIso = addIsoDays(actByIso, -1)
    guard += 1
  }
  const actByLabel = new Date(`${actByIso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
  // Working days left, counting today.
  let workingDaysLeft = 0
  for (let cursor = toLocalISODate(); cursor <= actByIso; cursor = addIsoDays(cursor, 1)) {
    if (isWorkingDay(cursor, holidays)) workingDaysLeft += 1
  }
  workingDaysLeft = Math.max(1, workingDaysLeft)

  type Bucket = { name: string; tasks: DigestTask[]; ownWorkOnly: boolean }
  const byRecipient = new Map<string, Bucket>()

  for (const t of tasks as Array<Record<string, string | null>>) {
    const deadline = taskDeadline(t as never) as string
    const excluded = nonWorkingDaysFor(holidays, (t.assigned_to && leaveByUser.get(t.assigned_to)) || [])
    if (!isGraceExhausted(graceStartFor(deadline), FAIL_DATE_ISO, excluded)) continue

    const selfAssigned = Boolean(t.assigned_to) && t.assigned_to === t.assigned_by
    let recipientId: string | null = null
    let recipientName = ""
    if (t.pm_id && t.pm_id !== t.assigned_to) {
      recipientId = t.pm_id
      recipientName = t.pm_name as string
    } else if (!selfAssigned && t.assigner_id) {
      recipientId = t.assigner_id
      recipientName = t.assigner as string
    } else {
      const lead = (leadByDept.get(String(t.department ?? "")) ?? []).find((l) => l.id !== t.assigned_to)
      if (lead) {
        recipientId = lead.id
        recipientName = lead.name
      } else {
        // Nobody sits above them: the assignee is told about their own work.
        recipientId = t.assigned_to
        recipientName = t.assignee as string
      }
    }
    if (!recipientId) continue

    const entry: DigestTask = {
      reference: t.work_item_number,
      assignee: t.assignee as string,
      deadline,
      daysLate: Math.round((Date.parse(FAIL_DATE_ISO) - Date.parse(deadline)) / 86_400_000),
      weight: Number(t.weight ?? 3),
      status: String(t.status),
      title: String(t.title ?? "")
        .replace(/\s+/g, " ")
        .trim(),
      project: t.project || null,
    }
    const bucket = byRecipient.get(recipientId) ?? { name: recipientName, tasks: [], ownWorkOnly: true }
    bucket.tasks.push(entry)
    if (t.assigned_to !== recipientId) bucket.ownWorkOnly = false
    byRecipient.set(recipientId, bucket)

    // The assignee gets their own copy when someone else is the decider.
    // Only they can submit the work, and that is the one remedy that earns
    // marks back - a mail that goes solely to the lead asks the wrong person.
    if (t.assigned_to && t.assigned_to !== recipientId) {
      const own = byRecipient.get(t.assigned_to) ?? {
        name: t.assignee as string,
        tasks: [],
        ownWorkOnly: true,
      }
      own.tasks.push(entry)
      byRecipient.set(t.assigned_to, own)
    }
  }

  // --self: one digest of this person's own overdue work, to themselves only.
  if (self) {
    const { rows: me } = await c.query(
      `select p.id, p.first_name from public.profiles p join auth.users u on u.id = p.id where lower(u.email) = $1`,
      [self]
    )
    const meRow = (me as Array<{ id: string; first_name: string }>)[0]
    if (!meRow) {
      console.log(`No account found for ${self}`)
      await c.end()
      return
    }
    const mine: DigestTask[] = []
    for (const b of byRecipient.values()) for (const t of b.tasks) void t
    for (const t of tasks as Array<Record<string, string | null>>) {
      if (t.assigned_to !== meRow.id) continue
      const deadline = taskDeadline(t as never) as string
      const excluded = nonWorkingDaysFor(holidays, leaveByUser.get(meRow.id) || [])
      if (!isGraceExhausted(graceStartFor(deadline), FAIL_DATE_ISO, excluded)) continue
      mine.push({
        reference: t.work_item_number,
        assignee: t.assignee as string,
        deadline,
        daysLate: Math.round((Date.parse(FAIL_DATE_ISO) - Date.parse(deadline)) / 86_400_000),
        weight: Number(t.weight ?? 3),
        status: String(t.status),
        title: String(t.title ?? "")
          .replace(/\s+/g, " ")
          .trim(),
        project: t.project || null,
      })
    }
    if (mine.length === 0) {
      console.log(`Nothing overdue for ${self}`)
      await c.end()
      return
    }
    const selfDept = deptById.get(meRow.id) || FALLBACK_DEPARTMENT
    const { subject, html } = renderTaskOverdueDigest({
      recipientName: meRow.first_name,
      actByLabel,
      workingDaysLeft,
      tasks: mine.sort((a, b) => a.deadline.localeCompare(b.deadline)),
      ownWorkOnly: true,
      department: selfDept,
      replyToLabel: replyToFor(selfDept),
    })
    if (!send) {
      console.log(`
  DRY (self)  ${self} - ${mine.length} task(s) - "${subject}"`)
    } else {
      const result = await sendNotificationEmailWithRetry({
        from: orgDepartmentSenderBare(selfDept),
        ...ORG_MAIL_ROUTING.Tasks,
        replyTo: replyToFor(selfDept),
        to: [self],
        subject,
        html,
      })
      console.log(
        result.sent
          ? `
  SENT (self)  ${self} - ${mine.length} task(s)`
          : `
  FAIL (self)  ${self} - ${"reason" in result ? result.reason : "unknown"}`
      )
    }
    await c.end()
    return
  }

  const ids = [...byRecipient.keys()]
  const { rows: users } = await c.query(`select id, email from auth.users where id = any($1::uuid[])`, [ids])
  const emailById = new Map<string, string>(
    (users as Array<{ id: string; email: string | null }>).filter((u) => u.email).map((u) => [u.id, u.email as string])
  )

  console.log(
    `\n${byRecipient.size} recipients, ${[...byRecipient.values()].reduce((n, b) => n + b.tasks.length, 0)} tasks`
  )
  console.log(send ? "MODE: SENDING FOR REAL" : "MODE: dry run (pass --send to actually send)")
  if (only) console.log(`FILTER: only ${only}`)
  console.log("")

  for (const [id, bucket] of byRecipient) {
    const email = emailById.get(id)
    if (!email) {
      console.log(`  SKIP  ${bucket.name} — no email address on file`)
      continue
    }
    if (only && email.toLowerCase() !== only) continue

    const bucketDept = deptById.get(id) || FALLBACK_DEPARTMENT
    const { subject, html } = renderTaskOverdueDigest({
      recipientName: bucket.name.split(" ")[0] || bucket.name,
      actByLabel,
      workingDaysLeft,
      tasks: bucket.tasks.sort((a, b) => a.deadline.localeCompare(b.deadline)),
      ownWorkOnly: bucket.ownWorkOnly,
      department: bucketDept,
      replyToLabel: replyToFor(bucketDept),
    })

    if (!send) {
      console.log(`  DRY   ${bucket.name} <${email}> — ${bucket.tasks.length} task(s) — "${subject}"`)
      continue
    }

    const result = await sendNotificationEmailWithRetry({
      from: orgDepartmentSenderBare(bucketDept),
      ...ORG_MAIL_ROUTING.Tasks,
      replyTo: replyToFor(bucketDept),
      to: [redirect || email],
      subject,
      html,
    })
    console.log(
      result.sent
        ? `  SENT  ${bucket.name} <${redirect || email}>${redirect ? " (redirected)" : ""} — ${bucket.tasks.length} task(s)`
        : `  FAIL  ${bucket.name} <${email}> — ${"reason" in result ? result.reason : "unknown"}`
    )
  }

  console.log("")
  await c.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
