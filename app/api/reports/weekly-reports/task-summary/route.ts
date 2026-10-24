import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { quotePostgrestValue } from "@/lib/supabase/postgrest-filter"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"
import {
  attachActionPoints,
  attachOpenTasks,
  attachPendingChallenges,
  getPreviousOfficeWeek,
  getWeeklyTaskWindow,
  summarizeWeeklyTasks,
  type SummaryActionPointRow,
  type SummaryChallengeRow,
  type SummaryPersonRow,
  type SummaryTaskRow,
} from "@/lib/reports/weekly-task-summary"

const log = logger("api-reports-weekly-reports-task-summary")

export const dynamic = "force-dynamic"

const DEFAULT_ANCHOR_DAY = 12

const QuerySchema = z.object({
  week: z.coerce.number().int().min(1).max(53),
  year: z.coerce.number().int().min(2000).max(2100),
})

// Task and action-point counts per department for the weekly report deck. The deck is
// presented to the whole meeting, so any signed-in staff member who can export
// it gets the same numbers; tasks RLS would only show them their own rows.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) return NextResponse.json({ error: "Invalid week/year" }, { status: 400 })
    const { week, year } = parsed.data

    const db = getServiceRoleClientOrFallback(supabase)

    const { data: config } = await db.from("office_year_config").select("anchor_day").eq("year", year).maybeSingle()
    const window = getWeeklyTaskWindow(week, year, config?.anchor_day ?? DEFAULT_ANCHOR_DAY)
    const q = quotePostgrestValue
    const startDay = q(window.startDate)
    const endDay = q(window.endDate)

    // Superset of the window — summarizeWeeklyTasks applies the exact rule.
    const { data: tasks, error: tasksError } = await db
      .from("tasks")
      .select("assigned_to, status, category, completed_at, due_date, task_end_date, created_at")
      .eq("is_archived", false)
      .not("assigned_to", "is", null)
      .not("status", "in", "(cancelled,reassigned)")
      .or(
        [
          `and(completed_at.gte.${q(window.startAt)},completed_at.lt.${q(window.endAt)})`,
          `and(due_date.gte.${startDay},due_date.lte.${endDay})`,
          `and(task_end_date.gte.${startDay},task_end_date.lte.${endDay})`,
          `and(due_date.is.null,task_end_date.is.null,created_at.gte.${q(window.startAt)},created_at.lt.${q(window.endAt)})`,
        ].join(",")
      )
    if (tasksError) return serverError(log, tasksError)

    // Action-tracker rows live in tasks too; they are department actions, not anyone's work.
    const taskRows = ((tasks ?? []) as Array<SummaryTaskRow & { category: string | null }>).filter(
      (t) => t.category !== "weekly_action"
    )
    // Open work with a deadline up to the end of the coming week: the ones due
    // in it, and everything already past due.
    const comingWeek = getWeeklyTaskWindow(week + 1, year, config?.anchor_day ?? DEFAULT_ANCHOR_DAY)
    const comingEnd = q(comingWeek.endDate)
    const { data: openTasks, error: openTasksError } = await db
      .from("tasks")
      .select("assigned_to, status, category, completed_at, due_date, task_end_date, created_at")
      .eq("is_archived", false)
      .not("assigned_to", "is", null)
      .in("status", ["pending", "in_progress", "submitted_for_review"])
      .or(`due_date.lte.${comingEnd},task_end_date.lte.${comingEnd}`)
    if (openTasksError) return serverError(log, openTasksError)
    const openTaskRows = ((openTasks ?? []) as Array<SummaryTaskRow & { category: string | null }>).filter(
      (t) => t.category !== "weekly_action"
    )

    const userIds = Array.from(
      new Set([...taskRows, ...openTaskRows].map((t) => t.assigned_to).filter((id): id is string => Boolean(id)))
    )

    // Every active member gets a row (0 / 0 when given nothing), plus anyone who
    // had tasks this week but has since left, so their work still counts.
    const { data: activeStaff, error: staffError } = await db
      .from("staff_directory")
      .select("id, first_name, last_name, department")
      .eq("employment_status", "active")
    if (staffError) return serverError(log, staffError)
    const peopleById = new Map(((activeStaff ?? []) as SummaryPersonRow[]).map((p) => [p.id, p]))

    const missing = userIds.filter((id) => !peopleById.has(id))
    if (missing.length > 0) {
      const { data, error: peopleError } = await db
        .from("staff_directory")
        .select("id, first_name, last_name, department")
        .in("id", missing)
      if (peopleError) return serverError(log, peopleError)
      ;((data ?? []) as SummaryPersonRow[]).forEach((p) => peopleById.set(p.id, p))
    }
    const people = Array.from(peopleById.values())

    const reviewed = getPreviousOfficeWeek(week, year)
    const { data: actionPoints, error: actionPointsError } = await db
      .from("action_items")
      .select("department, status")
      .eq("week_number", reviewed.week)
      .eq("year", reviewed.year)
    if (actionPointsError) return serverError(log, actionPointsError)

    const { data: challenges, error: challengesError } = await db
      .from("meeting_challenges")
      .select("department, status, week_number, year")
      .in("status", ["open", "mitigating"])
      .lte("year", year)
    if (challengesError) return serverError(log, challengesError)

    let summaries = summarizeWeeklyTasks(taskRows, people, window)
    summaries = attachActionPoints(summaries, (actionPoints ?? []) as SummaryActionPointRow[])
    summaries = attachOpenTasks(summaries, openTaskRows, people, comingWeek)
    summaries = attachPendingChallenges(summaries, (challenges ?? []) as SummaryChallengeRow[], week, year)
    return NextResponse.json({ data: summaries })
  } catch (error) {
    return serverError(log, error)
  }
}
