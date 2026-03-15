"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { QUERY_KEYS } from "@/lib/query-keys"

/**
 * Fetches departments directly from the `departments` table so the UI
 * is never out-of-sync with the database.
 *
 * Returns a sorted list of department *names* (strings) which is the
 * shape every consumer currently expects.
 */
async function fetchDepartmentNames(): Promise<string[]> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase.from("departments").select("name").eq("is_active", true).order("name")

  if (error) throw error
  return (data ?? []).map((d) => d.name)
}

export function useDepartments() {
  const queryClient = useQueryClient()

  const {
    data: departments = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.departments(),
    queryFn: fetchDepartmentNames,
    staleTime: 5 * 60 * 1000,
  })

  /** Force a fresh fetch (e.g. after creating a new department). */
  const refetchDepts = async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.departments() })
  }

  return {
    departments,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch departments") : null,
    refetch: refetchDepts,
  }
}
