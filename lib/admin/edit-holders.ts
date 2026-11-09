import type { SupabaseClient } from "@supabase/supabase-js"
import { EDIT_AREA_LABELS, editAreaFor, type AdminRouteKeyV2 } from "@/lib/admin/policy-v2"

export interface EditHolder {
  userId: string
  name: string
  /** "owner" = owns the area; "delegate" = lent it by an owner; "override" = standing edit given by an owner. */
  via: "owner" | "delegate" | "override"
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
 * Who can currently change things on an edit-guarded route: the owners of its area, plus anyone with
 * an active grant or delegation on the route or its group's umbrella key. Read live, so the view-only
 * notice stays right when an owner changes. `client` must be a service-role client (profiles RLS hides
 * other people).
 */
export async function loadEditHolders(client: SupabaseClient, route: AdminRouteKeyV2): Promise<EditHolder[]> {
  const holders = new Map<string, EditHolder>()

  const area = editAreaFor(route)
  if (area) {
    const { data: owners } = await client
      .from("edit_area_owners")
      .select("user_id")
      .eq("area", area)
      .returns<Array<{ user_id: string }>>()
    const ownerIds = (owners ?? []).map((row) => row.user_id)
    if (ownerIds.length > 0) {
      const { data: people } = await client
        .from("profiles")
        .select("id, full_name, first_name, last_name")
        .in("id", ownerIds)
        .neq("employment_status", "exited")
        .returns<ProfileName[]>()
      for (const person of people ?? []) {
        holders.set(person.id, { userId: person.id, name: displayName(person), via: "owner" })
      }
    }
  }

  const umbrella =
    route.startsWith("it.") || route.startsWith("security.")
      ? "it.main"
      : route === "scorecard.main"
        ? "scorecard.main"
        : route === "mddesk.main"
          ? "mddesk.main"
          : "hr.main"
  const keys = Array.from(new Set<string>([route, umbrella]))
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
      via: grant.delegated_from ? "delegate" : "override",
      delegatedFromName: grant.delegated_from ? displayName(names.get(grant.delegated_from)) : null,
      validUntil: grant.valid_until,
    })
  }

  return Array.from(holders.values())
}

/** The area's name for display, for example "HR" or "Corporate Services". */
export function ownerAreaLabel(route: AdminRouteKeyV2): string {
  const area = editAreaFor(route)
  return area ? EDIT_AREA_LABELS[area] : ""
}
