import { HydrationBoundary } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import { prefetchQueries } from "@/lib/query/prefetch"
import { QUERY_KEYS } from "@/lib/query-keys"
import { fetchActionTrackerMetadata, fetchActionTrackerTasks } from "./_lib/queries"
import { ActionTrackerPortal } from "./action-tracker-content"

export default async function ActionTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; year?: string; dept?: string }>
}) {
  // Prefetch the week the page opens on — the same week/year/dept the client
  // reads from the URL, falling back to the current office week (audit 6.8).
  const params = await searchParams
  const current = getCurrentOfficeWeek()
  const week = params.week ? parseInt(params.week, 10) : current.week
  const year = params.year ? parseInt(params.year, 10) : current.year
  const deptFilter = params.dept || "all"

  const supabase = await createClient()
  const state = await prefetchQueries([
    { queryKey: QUERY_KEYS.actionTrackerMetadata(), queryFn: () => fetchActionTrackerMetadata(supabase) },
    {
      queryKey: QUERY_KEYS.actionTrackerTasks({ week, year, deptFilter }),
      queryFn: () => fetchActionTrackerTasks(supabase, week, year, deptFilter),
    },
    {
      queryKey: QUERY_KEYS.weeklyReportLockState(week, year),
      queryFn: () => fetchWeeklyReportLockState(supabase, week, year),
    },
  ])

  return (
    <HydrationBoundary state={state}>
      <ActionTrackerPortal />
    </HydrationBoundary>
  )
}
