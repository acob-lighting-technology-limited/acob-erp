import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { toLocalISODate } from "@/lib/utils/date"
import {
  TASK_GRACE_WORKING_DAYS,
  graceStartFor,
  isGraceExhausted,
  nonWorkingDaysFor,
  taskDeadline,
  workingDaysPastDeadline,
} from "@/lib/tasks/overdue"
import { addIsoDays, eachIsoDate, isWorkingDay, type HolidaySet } from "@/lib/hr/leave-days"
import { sendTaskEmail } from "@/lib/tasks/mailer"

const log = logger("cron-tasks-expire-overdue")

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

type OverdueTaskRow = {
  id: string
  title: string | null
  assigned_to: string | null
  assigned_by: string | null
  due_date: string | null
  task_end_date: string | null
}

function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type Supabase = ReturnType<typeof serviceClient>

/**
 * Statuses that are still open work, and so can run out of time.
 *
 * unable_to_complete is deliberately absent: the employee has already reported
 * the task blocked, and whether to reassign, extend or fail it is the lead's
 * call. Failing it automatically would take that decision away and charge the
 * employee's KPI for a problem they raised.
 */
const OPEN_STATUSES = ["pending", "in_progress"]

/**
 * How far back holidays and leave are loaded. A grace period is two working
 * days, but leave can stretch it, so this covers a long absence without
 * pulling the whole calendar.
 */
const GRACE_LOOKBACK_DAYS = 120

/** A task sitting in grace is warned once, not on every nightly run. */
const WARN_COOLDOWN_HOURS = 20

/**
 * Closes out tasks whose deadline has passed - but not on the first night.
 *
 * An overdue task already scores zero: it sits at full weight with no rating,
 * which is what the KPI calculation wants. What was missing is anyone being
 * told. Without this, a task whose deadline passed stayed "pending" forever
 * unless a lead happened to notice and fail it by hand, so the employee's
 * score quietly dropped and nobody saw why.
 *
 * Failing it the very next night was too blunt, though. `failed` scores zero
 * at full weight and an employee cannot reverse it, yet the way out of a
 * missed deadline - a lead extending the due date, or closing the task out -
 * needs a human, and the last reminder went out the morning before. So the
 * first run past the deadline warns the assignee and the assigner instead, and
 * the task is failed only once TASK_GRACE_WORKING_DAYS working days have
 * elapsed. Counting in working days matters: a Friday deadline must not be
 * failed over a weekend nobody could have worked, and approved leave is
 * excluded for the same reason - someone signed off for a fortnight would
 * otherwise return to a wall of failures they had no chance to prevent.
 *
 * Work already submitted for review is deliberately left alone: the employee
 * delivered it, and a slow rater must not turn that into a failure.
 *
 * Idempotent - a run with nothing overdue changes nothing, and the warning is
 * guarded by a cooldown so a task in grace is not announced every night.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  }

  const supabase = serviceClient(supabaseUrl, supabaseServiceKey)

  try {
    const today = toLocalISODate()

    const { data: candidates, error: loadError } = await supabase
      .from("tasks")
      .select("id, title, assigned_to, assigned_by, due_date, task_end_date")
      .in("status", OPEN_STATUSES)
      .eq("is_archived", false)
      .returns<OverdueTaskRow[]>()

    if (loadError) throw loadError

    const overdue = (candidates || []).filter((task) => {
      const deadline = taskDeadline(task)
      return deadline !== null && deadline < today
    })

    if (overdue.length === 0) {
      log.info({ expired: 0, warned: 0 }, "No overdue tasks")
      return NextResponse.json({ data: { expired: 0, warned: 0, notified: 0 } })
    }

    // Public holidays extend the grace the same way weekends do, and so does
    // the assignee's own approved leave, so everyone gets two days they could
    // actually have worked.
    const windowStart = addIsoDays(today, -GRACE_LOOKBACK_DAYS)
    const assigneeIds = Array.from(new Set(overdue.map((task) => task.assigned_to).filter(Boolean) as string[]))
    const [holidays, leaveByUser] = await Promise.all([
      loadHolidays(supabase, windowStart, today),
      loadApprovedLeaveDates(supabase, assigneeIds, windowStart, today),
    ])

    /** Days that do not burn grace for the person who owes this task. */
    const excludedFor = (task: OverdueTaskRow): HolidaySet =>
      nonWorkingDaysFor(holidays, (task.assigned_to && leaveByUser.get(task.assigned_to)) || [])

    const toEscalate: OverdueTaskRow[] = []
    const toWarn: OverdueTaskRow[] = []
    for (const task of overdue) {
      // Grace runs from the deadline, or from the enforcement start date for
      // work that was already late before automatic failing began.
      const anchor = graceStartFor(taskDeadline(task) as string)
      if (isGraceExhausted(anchor, today, excludedFor(task))) toEscalate.push(task)
      else toWarn.push(task)
    }

    let warned = 0
    for (const task of toWarn) {
      const deadline = taskDeadline(task) as string
      const excluded = excludedFor(task)
      // Nothing is ticking on a weekend, a public holiday or a day the
      // assignee is on leave, so there is nothing worth waking them for.
      if (!isWorkingDay(today, excluded)) continue
      const used = workingDaysPastDeadline(graceStartFor(deadline), today, excluded)
      const left = Math.max(1, TASK_GRACE_WORKING_DAYS - used)
      // The in-app warning reaches a bell icon nobody opens, so the assignee
      // is emailed too - once, on the first night past the deadline. The
      // cooldown below is what keeps it to once.
      const alreadyWarned = task.assigned_to
        ? await recentlyNotified(supabase, task.assigned_to, task.id, "task_overdue")
        : true
      if (!alreadyWarned && task.assigned_to) {
        await sendTaskEmail(supabase, {
          kind: "overdue",
          taskId: task.id,
          recipientIds: [task.assigned_to],
          replyToUserId: task.assigned_by,
          actByLabel: actByLabelFor(today, excluded),
          workingDaysLeft: Math.max(1, TASK_GRACE_WORKING_DAYS - used),
        })
      }

      warned += await notifyBoth(supabase, task, {
        type: "task_overdue",
        title: "Task past its deadline",
        message:
          `"${task.title || "Untitled task"}" was due ${deadline} and is still open. ` +
          `Submit it, or have the deadline extended, within ${left} working day${left === 1 ? "" : "s"} ` +
          `- otherwise it will be escalated to your lead. If it is only part done, submit what you have: ` +
          `rated work earns part of the marks, while abandoned work earns none.`,
        priority: "high",
        cooldown: true,
      })
    }

    // Escalate tasks past grace to the lead / assigner. Tasks are NOT auto-failed;
    // human supervisors retain authority to extend, reassign, or mark as failed.
    let escalated = 0
    for (const task of toEscalate) {
      const alreadyEscalated = task.assigned_by
        ? await recentlyNotified(supabase, task.assigned_by, task.id, "task_escalated")
        : false

      if (!alreadyEscalated) {
        if (task.assigned_by) {
          await sendTaskEmail(supabase, {
            kind: "escalated",
            taskId: task.id,
            recipientIds: [task.assigned_by],
            replyToUserId: task.assigned_to,
          })
        }

        escalated += await notifyBoth(supabase, task, {
          type: "task_escalated",
          title: "Overdue task escalated",
          message: `"${task.title || "Untitled task"}" passed its deadline and grace period without completion and has been escalated to the lead for action.`,
          priority: "high",
          cooldown: true,
        })
      }
    }

    log.info({ escalated, warned, totalOverdue: overdue.length }, "Overdue tasks processed")

    return NextResponse.json({ data: { escalated, warned, totalOverdue: overdue.length } })
  } catch (error) {
    log.error({ err: String(error) }, "Overdue task expiry failed")
    return NextResponse.json({ error: "Failed to expire overdue tasks" }, { status: 500 })
  }
}

/**
 * The last day the assignee can still act: the working day before the grace
 * runs out. Naming the failure date instead would invite them to deal with it
 * the morning it had already gone.
 */
function actByLabelFor(todayIso: string, nonWorking: HolidaySet): string {
  let cursor = todayIso
  let remaining = TASK_GRACE_WORKING_DAYS
  let guard = 0
  while (remaining > 1 && guard < 30) {
    cursor = addIsoDays(cursor, 1)
    if (isWorkingDay(cursor, nonWorking)) remaining -= 1
    guard += 1
  }
  return new Date(`${cursor}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

async function loadHolidays(supabase: Supabase, start: string, end: string): Promise<HolidaySet> {
  const { data, error } = await supabase
    .from("holiday_calendar")
    .select("holiday_date")
    .gte("holiday_date", start)
    .lte("holiday_date", end)

  if (error) {
    // Weekends alone still give most of the intended grace, and a lookup
    // failure must not be allowed to fail the whole run.
    log.error({ err: String(error) }, "Holiday lookup failed; falling back to weekends only")
    return new Set<string>()
  }
  return new Set((data as Array<{ holiday_date: string }> | null)?.map((row) => row.holiday_date) ?? [])
}

/**
 * Approved leave for each assignee, expanded to the individual dates it
 * covers. Only approved leave counts: a request still sitting in the queue is
 * not yet time off, and treating it as such would let anyone pause a deadline
 * by filing one.
 */
async function loadApprovedLeaveDates(
  supabase: Supabase,
  userIds: string[],
  start: string,
  end: string
): Promise<Map<string, Set<string>>> {
  const byUser = new Map<string, Set<string>>()
  if (userIds.length === 0) return byUser

  const { data, error } = await supabase
    .from("leave_requests")
    .select("user_id, start_date, end_date")
    .in("user_id", userIds)
    .eq("status", "approved")
    .lte("start_date", end)
    .gte("end_date", start)

  if (error) {
    // Falling back to weekends and holidays alone can fail someone's task
    // while they were away, so this is loud rather than silent.
    log.error({ err: String(error) }, "Approved-leave lookup failed; grace will not account for leave")
    return byUser
  }

  for (const row of (data as Array<{ user_id: string; start_date: string; end_date: string }> | null) ?? []) {
    if (!row.user_id || !row.start_date || !row.end_date) continue
    const dates = byUser.get(row.user_id) ?? new Set<string>()
    for (const iso of eachIsoDate(row.start_date.slice(0, 10), row.end_date.slice(0, 10))) dates.add(iso)
    byUser.set(row.user_id, dates)
  }
  return byUser
}

/** Notifies the assignee and the assigner, counting the sends that landed. */
async function notifyBoth(
  supabase: Supabase,
  task: OverdueTaskRow,
  params: { type: string; title: string; message: string; priority: string; cooldown: boolean }
): Promise<number> {
  const recipients = new Set([task.assigned_to, task.assigned_by].filter(Boolean) as string[])
  let sent = 0
  for (const userId of recipients) {
    if (params.cooldown && (await recentlyNotified(supabase, userId, task.id, params.type))) continue
    try {
      // supabase-js reports RPC failures in the result rather than throwing.
      const { error: notifyRpcError } = await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: params.type,
        p_category: "tasks",
        p_title: params.title,
        p_message: params.message,
        p_priority: params.priority,
        p_link_url: "/tasks",
        p_actor_id: null,
        p_entity_type: "task",
        p_entity_id: task.id,
        p_rich_content: null,
      })
      if (notifyRpcError) throw notifyRpcError
      sent += 1
    } catch (notifyError) {
      log.error({ err: String(notifyError), taskId: task.id, userId }, "Failed to notify on overdue task")
    }
  }
  return sent
}

/** Has this person already been told about this task inside the cooldown? */
async function recentlyNotified(supabase: Supabase, userId: string, taskId: string, type: string): Promise<boolean> {
  const since = new Date(Date.now() - WARN_COOLDOWN_HOURS * 3_600_000).toISOString()
  const { count } = await supabase
    .from("notifications")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("entity_id", taskId)
    .eq("type", type)
    .gte("created_at", since)
  return Boolean(count && count > 0)
}
