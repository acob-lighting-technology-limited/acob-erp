"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

const NO_CYCLES: unknown[] = []

/**
 * Review cycles from /api/hr/performance/cycles, cached once for every PMS
 * screen. Cycles mostly label and filter other data, so callers treat a
 * failure as "no cycles" rather than blocking the page. Each caller narrows the
 * row type to the fields it reads.
 */
export function usePerformanceCycles<T = { id: string; name: string }>() {
  const query = useQuery({
    queryKey: QUERY_KEYS.performanceCycles(),
    queryFn: async () => (await apiJson<{ data?: unknown[] }>("/api/hr/performance/cycles")).data ?? [],
  })
  return { ...query, cycles: (query.data ?? NO_CYCLES) as T[] }
}

/** Refresh every screen's cycle list after a cycle is created, edited or deleted. */
export function useInvalidatePerformanceCycles() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.performanceCycles() })
}
