import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeDepartmentName } from "@/shared/departments"
import type { Database } from "@/types/database"

/** A department console a lead is entitled to open. */
export interface DeptConsole {
  id: string
  name: string
  href: string
}

interface LeadProfileLike {
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
  department?: string | null
}

/**
 * Resolve every department console a lead may open, in name order.
 *
 * A lead can hold more than one department (see the 20260911150000 migration),
 * so this returns all of them rather than just the first. Falls back to the
 * profile's home department for a lead whose array has not been populated yet.
 */
export async function resolveDeptConsoles(
  supabase: SupabaseClient<Database>,
  profile: LeadProfileLike | null | undefined
): Promise<DeptConsole[]> {
  if (!profile?.is_department_lead) return []

  const leadDepts = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  const source = leadDepts.length > 0 ? leadDepts : [profile.department]

  const names = Array.from(
    new Set(
      source
        .filter((name): name is string => typeof name === "string" && name.trim() !== "")
        .map((name) => normalizeDepartmentName(name))
    )
  )
  if (names.length === 0) return []

  const { data } = await supabase.from("departments").select("id, name").in("name", names)

  // The multi-column select widens to `never` under this supabase-js version,
  // so the row shape is asserted against the generated departments Row type.
  type DeptRow = Pick<Database["public"]["Tables"]["departments"]["Row"], "id" | "name">
  const rows = (data ?? []) as unknown as DeptRow[]

  return rows
    .filter((row) => Boolean(row?.id && row?.name))
    .map((row) => ({ id: row.id, name: row.name, href: `/dept/${row.id}` }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
