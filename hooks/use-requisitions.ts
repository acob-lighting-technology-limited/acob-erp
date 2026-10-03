"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { Requisition, RequisitionFundingCategory } from "@/lib/requisitions/types"

export interface RequisitionListFilter {
  /** Only the caller's own requisitions. */
  userOnly?: boolean
  status?: string
}

async function fetchRequisitions(filter: RequisitionListFilter): Promise<Requisition[]> {
  const params = new URLSearchParams()
  if (filter.userOnly) params.set("user_only", "true")
  if (filter.status) params.set("status", filter.status)
  const query = params.toString()
  const payload = await apiJson<{ data?: Requisition[] }>(`/api/requisitions${query ? `?${query}` : ""}`)
  return payload.data ?? []
}

/**
 * The requisition list behind the staff, department and admin screens. The
 * API scopes rows to what the caller may see; `select` narrows further on the
 * client (e.g. to one department console) without a second request shape.
 */
export function useRequisitions(filter: RequisitionListFilter = {}, select?: (rows: Requisition[]) => Requisition[]) {
  return useQuery({
    queryKey: QUERY_KEYS.requisitions({ ...filter }),
    queryFn: () => fetchRequisitions(filter),
    select,
    placeholderData: keepPreviousData,
  })
}

/** Funding categories for the requisition form (active only) or the admin manager (all). */
export function useFundingCategories({ includeInactive = false, enabled = true } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.requisitionFundingCategories(includeInactive),
    queryFn: async () =>
      (
        await apiJson<{ data?: RequisitionFundingCategory[] }>(
          `/api/requisitions/funding-categories${includeInactive ? "?include_inactive=true" : ""}`
        )
      ).data ?? [],
    enabled,
  })
}
