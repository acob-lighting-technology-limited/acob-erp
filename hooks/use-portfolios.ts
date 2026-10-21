"use client"

import { useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { Portfolio, ProjectHealthRow } from "@/app/admin/portfolios/_components/portfolios-content"
import type { PortfolioHealth } from "@/lib/projects/health"

export type PortfoliosPayload = {
  data: Portfolio[]
  unassigned: { projects: ProjectHealthRow[]; rollup: PortfolioHealth }
}

/** Portfolios with their health rollups — one cache entry for the list, detail and project dialogs. */
export function usePortfolios({ enabled = true } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.portfolios(),
    queryFn: () => apiJson<PortfoliosPayload>("/api/portfolios", { cache: "no-store" }),
    enabled,
  })
}
