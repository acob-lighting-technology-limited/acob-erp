import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import {
  buildAccessContextV2,
  canAccessRouteV2,
  canEditRouteV2,
  HR_EDIT_ROUTES,
  IT_EDIT_ROUTES,
  CS_EDIT_ROUTES,
  MD_EDIT_ROUTES,
  isEditOwnerV2,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/access/people")
export const dynamic = "force-dynamic"

type Group = "hr" | "it" | "cs" | "md"
type Level = "edit" | "view" | "none"
/** Where a person's edit comes from; null when they only view. */
type Via = "owner" | "override" | "delegation" | "some" | null

export interface AccessCell {
  level: Level
  via: Via
  /** Standing override rows in this group: withdrawing them turns edit back into view. */
  grantIds: string[]
  /** Plain-language note, e.g. "Delegated by Onyekachukwu until 30 Nov". */
  note: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  role: string
  department: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
  admin_routes: string[] | null
}

type GrantRow = {
  id: string
  user_id: string
  route_key: string
  delegated_from: string | null
  valid_until: string | null
}

const GROUP_KEYS: Record<Group, { umbrella: AdminRouteKeyV2; routes: AdminRouteKeyV2[]; area: string }> = {
  hr: { umbrella: "hr.main", routes: HR_EDIT_ROUTES, area: "hr" },
  it: { umbrella: "it.main", routes: IT_EDIT_ROUTES, area: "it" },
  cs: { umbrella: "scorecard.main", routes: CS_EDIT_ROUTES, area: "corporate_services" },
  md: { umbrella: "mddesk.main", routes: MD_EDIT_ROUTES, area: "md_desk" },
}

function nameOf(row: Pick<ProfileRow, "full_name" | "first_name" | "last_name"> | undefined) {
  if (!row) return "Unknown"
  return row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unknown"
}

/**
 * GET: every admin, super admin and developer, with what they can do in HR and IT
 * (view, edit, or no access). Developers and super admins only: this is the screen
 * that decides who may edit.
 */
export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth
  const actorContext = buildAccessContextV2(scope)
  // What this person may change: only the areas they own as lead. Others see the list, read only.
  const canChange = {
    hr: isEditOwnerV2(actorContext, "hr.main"),
    it: isEditOwnerV2(actorContext, "it.main"),
    cs: isEditOwnerV2(actorContext, "scorecard.main"),
    md: isEditOwnerV2(actorContext, "mddesk.main"),
  }
  const isDevOrSuper = scope.role === "developer" || scope.role === "super_admin"
  // Any admin-role person may look at the list; only owners can change their own areas.
  if (!isDevOrSuper && !scope.isAdminLike) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const client = getServiceRoleClientOrFallback(supabase)
  const { data: people, error } = await client
    .from("profiles")
    .select(
      "id, full_name, first_name, last_name, role, department, is_department_lead, lead_departments, admin_routes"
    )
    .in("role", ["admin", "super_admin", "developer"])
    .neq("employment_status", "exited")
    .order("full_name", { ascending: true })
    .returns<ProfileRow[]>()
  if (error) return serverError(log, error)

  const { data: grants, error: grantError } = await client
    .from("admin_edit_grants")
    .select("id, user_id, route_key, delegated_from, valid_until")
    .is("revoked_at", null)
    .returns<GrantRow[]>()
  if (grantError) return serverError(log, grantError)

  const { data: ownerRows } = await client
    .from("edit_area_owners")
    .select("area, user_id")
    .returns<Array<{ area: string; user_id: string }>>()
  const ownedBy = new Map<string, string[]>()
  for (const row of ownerRows ?? []) ownedBy.set(row.user_id, [...(ownedBy.get(row.user_id) ?? []), row.area])

  const now = Date.now()
  const live = (grants ?? []).filter((grant) => !grant.valid_until || new Date(grant.valid_until).getTime() > now)
  const nameById = new Map((people ?? []).map((person) => [person.id, nameOf(person)]))
  const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" })

  const rows = (people ?? []).map((person) => {
    const mine = live.filter((grant) => grant.user_id === person.id)
    const context = buildAccessContextV2({
      role: person.role,
      isDepartmentLead: Boolean(person.is_department_lead),
      isAdminLike: true,
      adminRoutes: person.admin_routes as AdminRouteKeyV2[] | null,
      scopeMode: "global",
      managedDepartments: [],
      department: person.department,
      leadDepartments: person.lead_departments ?? [],
      editRoutes: mine.map((grant) => grant.route_key as AdminRouteKeyV2),
      editOverrideRoutes: mine
        .filter((grant) => !grant.delegated_from)
        .map((grant) => grant.route_key as AdminRouteKeyV2),
      ownedAreas: ownedBy.get(person.id) ?? [],
    })

    const cell = (group: Group): AccessCell => {
      const { umbrella, routes } = GROUP_KEYS[group]
      const groupGrants = mine.filter((grant) => routes.includes(grant.route_key as AdminRouteKeyV2))
      const grantIds = groupGrants.filter((grant) => !grant.delegated_from).map((grant) => grant.id)

      if (!canAccessRouteV2(context, umbrella)) {
        // Some admins reach only part of a group (for example Attendance but not the rest of HR).
        const reachesSome = routes.some((route) => canAccessRouteV2(context, route))
        return {
          level: reachesSome ? "view" : "none",
          via: null,
          grantIds,
          note: reachesSome ? "Some areas only" : null,
        }
      }
      if (isEditOwnerV2(context, umbrella)) {
        return { level: "edit", via: "owner", grantIds, note: "Owner" }
      }
      if (canEditRouteV2(context, umbrella)) {
        const delegated = groupGrants.find((grant) => grant.delegated_from && grant.route_key === umbrella)
        if (!grantIds.length && delegated) {
          const until = delegated.valid_until ? ` until ${dateFormat.format(new Date(delegated.valid_until))}` : ""
          return {
            level: "edit",
            via: "delegation",
            grantIds,
            note: `Delegated by ${nameById.get(delegated.delegated_from ?? "") ?? "a lead"}${until}`,
          }
        }
        return { level: "edit", via: "override", grantIds, note: "Override" }
      }
      if (groupGrants.length > 0) {
        return { level: "edit", via: "some", grantIds, note: "Edit on some areas only" }
      }
      return { level: "view", via: null, grantIds, note: null }
    }

    return {
      id: person.id,
      name: nameOf(person),
      role: person.role,
      department: person.department,
      is_self: person.id === scope.userId,
      hr: cell("hr"),
      it: cell("it"),
      cs: cell("cs"),
      md: cell("md"),
    }
  })

  return NextResponse.json({ data: rows, can_change: canChange })
}
