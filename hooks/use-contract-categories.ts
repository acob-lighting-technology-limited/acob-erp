"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

export interface ContractCategory {
  id: string
  code: string
  name: string
  is_active?: boolean
  sort_order?: number | null
}

async function fetchContractCategories(): Promise<ContractCategory[]> {
  const res = await apiFetch("/api/admin/hr/employment-categories")
  const body = (await res.json().catch(() => ({}))) as { data?: ContractCategory[]; error?: string }
  if (!res.ok) throw new Error(body.error || "Failed to load contract categories")
  return body.data ?? []
}

/** Active contract categories (NYSC, SIWES, …) for employee and applicant forms. */
export function useContractCategories(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.contractCategories(),
    queryFn: fetchContractCategories,
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}
