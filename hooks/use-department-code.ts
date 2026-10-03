"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { normalizeDepartmentName } from "@/shared/departments"
import { QUERY_KEYS } from "@/lib/query-keys"

type DepartmentRow = { name?: string | null; department_code?: string | null }

/**
 * Lookup for lists that show many departments: name → short code ("ACC", "HR"),
 * from /api/departments, falling back to the name itself while loading or when
 * a department has no code.
 */
export function useDepartmentCodes(): (department: string | null | undefined) => string {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.departmentRows(),
    queryFn: async (): Promise<DepartmentRow[]> => {
      const res = await apiFetch("/api/departments", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load departments")
      const json = (await res.json()) as { data?: DepartmentRow[] }
      return json.data ?? []
    },
    staleTime: 10 * 60 * 1000,
  })
  const codes = new Map(
    (data ?? [])
      .filter((row) => row.department_code)
      .map((row) => [normalizeDepartmentName(String(row.name || "")), String(row.department_code)])
  )
  return (department) => (department ? (codes.get(normalizeDepartmentName(department)) ?? department) : "")
}
