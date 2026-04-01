"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { QUERY_KEYS } from "@/lib/query-keys"

/**
 * Fetches active office location names directly from the `office_locations`
 * table so the UI is never out-of-sync with the database.
 *
 * To rename a location update it in Admin → HR → Office Locations;
 * that page automatically bulk-updates all employee profile references.
 */
async function fetchOfficeLocationNames(): Promise<string[]> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase.from("office_locations").select("name").eq("is_active", true).order("name")

  if (error) throw error
  return (data ?? []).map((d) => d.name)
}

export function useOfficeLocations() {
  const queryClient = useQueryClient()

  const {
    data: officeLocations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.officeLocations(),
    queryFn: fetchOfficeLocationNames,
    staleTime: 5 * 60 * 1000,
  })

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.officeLocations() })
  }

  return {
    officeLocations,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch office locations") : null,
    refetch,
  }
}
