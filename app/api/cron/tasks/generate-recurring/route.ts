import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { toLocalISODate } from "@/lib/utils/date"
import { repeatsDue } from "@/lib/tasks/recurrence"
import {
  TASK_SERIES_COLUMNS,
  createSeriesRepeats,
  loadSeriesAssignees,
  loadSeriesHolidays,
  notifySeriesRepeats,
  scheduleOf,
  seriesHolidayWindow,
  type TaskSeriesRow,
} from "@/lib/tasks/series"

const log = logger("cron-tasks-generate-recurring")

/**
 * Turns every live task series into the tasks it owes today.
 *
 * Runs at 05:00 WAT, before the morning reminders. For each series it creates
 * the repeats whose creation day has arrived (lib/tasks/recurrence.ts decides
 * which), so a monthly task appears five working days ahead and a daily one
 * the morning it is due.
 *
 * Idempotent: the (series_id, occurrence_date) unique constraint means a
 * second run the same day, or two runs overlapping, creates nothing new. A
 * repeat whose deadline passed while the job was down is not created late -
 * it would be overdue the moment it appeared.
 *
 * Also does the series' own housekeeping: a pause whose end date has passed is
 * lifted, and a series past its end date is marked ended.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const today = toLocalISODate()

    const { data: seriesRows, error: loadError } = await supabase
      .from("task_series")
      .select(TASK_SERIES_COLUMNS)
      .in("status", ["active", "paused"])
      .returns<TaskSeriesRow[]>()
    if (loadError) throw loadError

    const live = seriesRows || []
    if (live.length === 0) {
      return NextResponse.json({ data: { series: 0, created: 0, notified: 0 } })
    }

    const earliestPause = live
      .map((s) => s.paused_from)
      .filter(Boolean)
      .sort()[0] as string | undefined
    const [holidayStart, holidayEnd] = seriesHolidayWindow(today, earliestPause)
    const [holidays, assigneesBySeries] = await Promise.all([
      loadSeriesHolidays(supabase, holidayStart, holidayEnd),
      loadSeriesAssignees(
        supabase,
        live.map((s) => s.id)
      ),
    ])

    let created = 0
    let notified = 0
    let resumed = 0
    let ended = 0
    let failed = 0

    for (const series of live) {
      try {
        // Planned with the pause still in place, so a monthly repeat the pause
        // moved is created against its moved deadline before the pause is lifted.
        const pause = { paused_from: series.paused_from, paused_until: series.paused_until }
        const planned = repeatsDue(scheduleOf(series), pause, today, holidays)
        const rows = await createSeriesRepeats(supabase, series, assigneesBySeries.get(series.id) ?? [], planned)
        created += rows.length
        notified += await notifySeriesRepeats(supabase, series, rows)

        const update: Record<string, unknown> = { last_generated_at: new Date().toISOString() }
        if (series.status === "paused" && series.paused_until && series.paused_until < today) {
          update.status = "active"
          update.paused_from = null
          update.paused_until = null
          resumed += 1
        }
        if (series.end_date && series.end_date < today) {
          update.status = "ended"
          update.paused_from = null
          update.paused_until = null
          update.end_reason = "end_date_reached"
          update.ended_at = new Date().toISOString()
          ended += 1
        }

        const { error: updateError } = await supabase.from("task_series").update(update).eq("id", series.id)
        if (updateError) throw updateError
      } catch (seriesError) {
        // One broken series must not stop everyone else's work being created.
        failed += 1
        log.error({ err: String(seriesError), seriesId: series.id }, "Series generation failed")
      }
    }

    log.info({ series: live.length, created, notified, resumed, ended, failed }, "Recurring tasks generated")
    return NextResponse.json({ data: { series: live.length, created, notified, resumed, ended, failed } })
  } catch (error) {
    log.error({ err: String(error) }, "Recurring task generation failed")
    return NextResponse.json({ error: "Failed to generate recurring tasks" }, { status: 500 })
  }
}
