"use client"

import { useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { normalizeDepartmentName } from "@/shared/departments"
import { QUERY_KEYS } from "@/lib/query-keys"

type DepartmentRow = { name?: string | null; department_code?: string | null }

/**
 * Short code ("ACC", "HR") for a department name, from /api/departments.
 * Shared by both sidebars; null until loaded or when the name has no code.
 */
export function useDepartmentCode(department: string | null | undefined): string | null {
  const name = department ? normalizeDepartmentName(department) : ""
  const { data } = useQuery({
    queryKey: QUERY_KEYS.departmentRows(),
    queryFn: async () =>
      (await apiJson<{ data?: DepartmentRow[] }>("/api/departments", { cache: "no-store" })).data ?? [],
    enabled: Boolean(name),
    staleTime: 10 * 60 * 1000,
  })
  if (!name) return null
  return data?.find((row) => normalizeDepartmentName(String(row.name || "")) === name)?.department_code || null
}
