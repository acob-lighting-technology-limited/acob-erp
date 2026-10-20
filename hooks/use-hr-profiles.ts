"use client"

import { useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

const NO_PROFILES: unknown[] = []

/** Every profile the caller may see, from /api/hr/profiles?all=true. Callers narrow the row type. */
export function useHrProfiles<T = { id: string; first_name: string | null; last_name: string | null }>({
  enabled = true,
} = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.hrProfilesAll(),
    queryFn: async () => (await apiJson<{ data?: unknown[] }>("/api/hr/profiles?all=true")).data ?? [],
    enabled,
  })
  return { ...query, profiles: (query.data ?? NO_PROFILES) as T[] }
}
