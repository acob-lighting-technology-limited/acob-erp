"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { autoNumberReportText, autoNumberReportTexts, type ReportTexts } from "@/lib/reports/weekly-report-text"

export interface WeeklyReportSeed {
  /** The department's existing report for the week, if one was already filed. */
  existing: { id: string; user_id: string | null; status: string | null; texts: ReportTexts } | null
  /** Next week's tracker already has non-pending report-derived items. */
  isNextWeekActive: boolean
  /** "Tasks for new week" rebuilt from report-derived action items, for a week with no report yet. */
  syncedTasks: string | null
}

async function fetchWeeklyReportSeed(department: string, week: number, year: number): Promise<WeeklyReportSeed> {
  const supabase = createClient()
  const [{ data: existing }, { data: actions }] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("id, user_id, work_done, tasks_new_week, challenges, status")
      .eq("department", department)
      .eq("week_number", week)
      .eq("year", year)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Report-derived items only: a management directive must never be folded
    // back into the department's "Tasks for New Week" text, nor decide whether
    // the next week is already active.
    supabase
      .from("action_items")
      .select("title, status")
      .eq("department", department)
      .eq("week_number", week)
      .eq("year", year)
      .eq("origin", "weekly_report"),
  ])

  const items = actions ?? []
  return {
    existing: existing
      ? { id: existing.id, user_id: existing.user_id, status: existing.status, texts: autoNumberReportTexts(existing) }
      : null,
    isNextWeekActive: items.some((a) => a.status !== "pending"),
    syncedTasks: items.length > 0 ? autoNumberReportText(items.map((a, i) => `${i + 1}. ${a.title}`).join("\n")) : null,
  }
}

/** What a weekly report form for (department, week, year) should start from. */
export function useWeeklyReportSeed(department: string, week: number, year: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.weeklyReportSeed(department, week, year),
    queryFn: () => fetchWeeklyReportSeed(department, week, year),
    enabled: enabled && Boolean(department),
    staleTime: 0,
  })
}

/** Starting texts for a form: the existing report, else tasks synced from the tracker, else blank. */
export function seedTexts(seed: WeeklyReportSeed | undefined): ReportTexts {
  if (seed?.existing) return seed.existing.texts
  return { work_done: "", tasks_new_week: seed?.syncedTasks ?? "", challenges: "" }
}
