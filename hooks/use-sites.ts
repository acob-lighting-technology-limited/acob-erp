"use client"

import { useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { SitesPayload } from "@/lib/sites/records"

/** The Sites register, whole or narrowed to one portfolio. `canEdit` says whether the viewer may change it. */
export function useSites(portfolioId: string | null = null) {
  return useQuery({
    queryKey: QUERY_KEYS.sites(portfolioId),
    queryFn: () =>
      apiJson<SitesPayload>(portfolioId ? `/api/sites?portfolio_id=${encodeURIComponent(portfolioId)}` : "/api/sites", {
        cache: "no-store",
      }),
  })
}
