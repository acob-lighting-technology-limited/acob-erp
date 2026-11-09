import type { SupabaseClient } from "@supabase/supabase-js"
import { editOwnerDepartmentsFor, type AdminRouteKeyV2 } from "@/lib/admin/policy-v2"
import { isSameDepartment, getDepartmentAliases } from "@/shared/departments"

export interface EditHolder {
  userId: string
  name: string
  /** "lead" = leads the owning department; "grant" = explicit grant; "delegate" = delegated by someone. */
  via: "lead" | "grant" | "delegate"
  /** For a delegate: who delegated, and until when. */
  delegatedFromName?: string | null
  validUntil?: string | null
}

type ProfileName = { id: string; full_name: string | null; first_name: string | null; last_name: string | null }

function displayName(p: ProfileName | undefined): string {
  if (!p) return "Unknown"
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unknown"
}

/**
 * Who can currently change things on an edit-guarded route: the lead(s) of the owning
 * department(s), plus anyone with an active grant or delegation on the route or its
 * group's umbrella key. Read live, so the "view only" notice stays right when a lead
 * changes. `client` must be a service-role client (profiles RLS hides other people).
 */
export async function loadEditHolders(client: SupabaseClient, route: AdminRouteKeyV2): Promise<EditHolder[]> {
  const holders = new Map<string, EditHolder>()

  const ownerDepartments = editOwnerDepartmentsFor(route)
  if (ownerDepartments.length > 0) {
    const { data: leads } = await client
      .from("profiles")
      .select("id, full_name, first_name, last_name, department, lead_departments")
      .eq("is_department_lead", true)
      .neq("employment_status", "exited")
      .returns<Array<ProfileName & { department: string | null; lead_departments: string[] | null }>>()
    for (const lead of leads ?? []) {
      const led = lead.lead_departments && lead.lead_departments.length > 0 ? lead.lead_departments : [lead.department]
      const owns = led.some((dept) => ownerDepartments.some((owner) => isSameDepartment(dept, owner)))
      if (owns) holders.set(lead.id, { userId: lead.id, name: displayName(lead), via: "lead" })
    }
  }

  const keys = Array.from(
    new Set<string>([route, route.startsWith("it.") || route.startsWith("security.") ? "it.main" : "hr.main"])
  )
  const { data: grants } = await client
    .from("admin_edit_grants")
    .select("user_id, route_key, delegated_from, valid_until")
    .in("route_key", keys)
    .is("revoked_at", null)
    .returns<Array<{ user_id: string; route_key: string; delegated_from: string | null; valid_until: string | null }>>()
  const now = Date.now()
  const live = (grants ?? []).filter((g) => !g.valid_until || new Date(g.valid_until).getTime() > now)

  const ids = Array.from(new Set(live.flatMap((g) => [g.user_id, g.delegated_from].filter(Boolean) as string[])))
  const names = new Map<string, ProfileName>()
  if (ids.length > 0) {
    const { data: people } = await client
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", ids)
      .returns<ProfileName[]>()
    for (const person of people ?? []) names.set(person.id, person)
  }
  for (const grant of live) {
    if (holders.has(grant.user_id)) continue
    holders.set(grant.user_id, {
      userId: grant.user_id,
      name: displayName(names.get(grant.user_id)),
      via: grant.delegated_from ? "delegate" : "grant",
      delegatedFromName: grant.delegated_from ? displayName(names.get(grant.delegated_from)) : null,
      validUntil: grant.valid_until,
    })
  }

  return Array.from(holders.values())
}

/** Department-lead profiles that own `route`, as department names for display. */
export function ownerDepartmentLabel(route: AdminRouteKeyV2): string {
  const owners = editOwnerDepartmentsFor(route)
  return owners.map((owner) => getDepartmentAliases(owner)[0] ?? owner).join(" and ")
}
