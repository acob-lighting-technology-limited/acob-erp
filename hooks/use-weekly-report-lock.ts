"use client"

import { useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { fetchWeeklyReportLockState, type WeeklyReportLockState } from "@/lib/weekly-report-lock"

/**
 * Lock state for an office week, read through the caller's own session (the
 * RPC works for staff and department leads, not only admins). Use in report
 * forms; while it resolves `data` is undefined — treat that as locked.
 */
export function useWeeklyReportLockState(week: number, year: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.weeklyReportLockState(week, year),
    queryFn: () => fetchWeeklyReportLockState(createClient(), week, year),
    enabled,
  })
}

/** Admin screens: the same lock state via the admin route (adds override/unlock info). */
export function useAdminWeeklyReportLockState(week: number, year: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.adminWeeklyReportLockState(week, year),
    queryFn: () =>
      apiJson<WeeklyReportLockState>(`/api/admin/reports/weekly-lock-state?week=${week}&year=${year}`, {
        cache: "no-store",
      }),
    enabled,
  })
}
