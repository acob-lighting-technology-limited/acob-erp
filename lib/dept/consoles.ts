import type { SupabaseClient } from "@supabase/supabase-js"
import { consolePageKeys } from "@/lib/dept/delegated-pages"
import { normalizeDepartmentName } from "@/shared/departments"
import type { Database } from "@/types/database"

/** A department console a lead is entitled to open, or a delegate has been given pages of. */
export interface DeptConsole {
  id: string
  name: string
  href: string
  /** Opened through a delegation: only some pages are available. */
  delegated?: boolean
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
  profile: LeadProfileLike | null | undefined,
  userId?: string
): Promise<DeptConsole[]> {
  const led = await resolveLedConsoles(supabase, profile)
  if (!userId) return led
  const delegated = await resolveDelegatedConsoles(supabase, userId)
  const ledIds = new Set(led.map((console) => console.id))
  return [...led, ...delegated.filter((console) => !ledIds.has(console.id))].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

/** Departments the person has been given pages of and that have not ended or been withdrawn. */
async function resolveDelegatedConsoles(supabase: SupabaseClient<Database>, userId: string): Promise<DeptConsole[]> {
  const { data } = await supabase
    .from("dept_delegations" as never)
    .select("department_id, pages")
    .eq("delegate_id", userId)
    .is("revoked_at", null)
    .gt("valid_until", new Date().toISOString())
  const live = ((data ?? []) as unknown as Array<{ department_id: string; pages: string[] | null }>).filter(
    (row) => consolePageKeys(row.pages ?? []).length > 0
  )
  const ids = Array.from(new Set(live.map((row) => row.department_id)))
  if (ids.length === 0) return []
  const { data: depts } = await supabase.from("departments").select("id, name").in("id", ids)
  type DeptRow = Pick<Database["public"]["Tables"]["departments"]["Row"], "id" | "name">
  return ((depts ?? []) as unknown as DeptRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    href: `/dept/${row.id}`,
    delegated: true,
  }))
}

async function resolveLedConsoles(
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
