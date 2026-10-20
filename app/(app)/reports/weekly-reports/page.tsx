import { HydrationBoundary } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/server"
import { getReportingOfficeWeek } from "@/lib/meeting-week"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import { fetchProfileAndDepartments, fetchWeeklyReports } from "@/lib/reports/weekly-reports-data"
import { prefetchQueries } from "@/lib/query/prefetch"
import { QUERY_KEYS } from "@/lib/query-keys"
import { WeeklyReportsPortal } from "./weekly-reports-content"

export default async function WeeklyReportsPage() {
  // Prefetch the opening view (the reporting week, all departments) with the
  // request's own session, so the table paints with reports (audit 6.8). The
  // server uses the default office-year anchor; if a year's anchor differs the
  // keys simply miss and the client fetches as before.
  const supabase = await createClient()
  const { week, year } = getReportingOfficeWeek()
  const state = await prefetchQueries([
    { queryKey: QUERY_KEYS.weeklyReportsProfile(), queryFn: () => fetchProfileAndDepartments(supabase) },
    {
      queryKey: QUERY_KEYS.weeklyReports({ week, year, dept: "all" }),
      queryFn: () => fetchWeeklyReports(supabase, week, year, "all"),
    },
    {
      queryKey: QUERY_KEYS.weeklyReportLockState(week, year),
      queryFn: () => fetchWeeklyReportLockState(supabase, week, year),
    },
  ])

  return (
    <HydrationBoundary state={state}>
      <WeeklyReportsPortal />
    </HydrationBoundary>
  )
}
