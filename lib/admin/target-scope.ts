import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getScopedDepartments } from "@/lib/admin/api-scope"
import type { AdminScope } from "@/lib/admin/rbac"
import { isSameDepartment } from "@/shared/departments"

/**
 * Ownership checks for admin API routes that act on one record by id.
 *
 * Those routes run on the service-role client, so row-level security does not apply. A route that only
 * asks "is this person a lead?" lets a lead of any department read or change another department's
 * records by calling the API with that record's id. These helpers close that: an unrestricted
 * (global admin) scope passes straight through, a department-scoped one must own the target.
 *
 * Each returns a `NextResponse` to send back, or `null` to carry on.
 */

const OUTSIDE_SCOPE = "Forbidden: outside your department scope"

/** Whether `department` is one of the scoped departments (alias- and case-insensitive). */
export function departmentInScope(scopeDepartments: string[] | null, department: string | null | undefined): boolean {
  if (scopeDepartments === null) return true
  if (!department) return false
  return scopeDepartments.some((scoped) => isSameDepartment(scoped, department))
}

const forbidden = () => NextResponse.json({ error: OUTSIDE_SCOPE }, { status: 403 })
const notFound = (what: string) => NextResponse.json({ error: `${what} not found` }, { status: 404 })

/** An employee is in scope when their department is one the viewer manages. */
export async function denyUnlessEmployeeInScope(
  db: SupabaseClient,
  scope: AdminScope,
  userId: string
): Promise<NextResponse | null> {
  const scopeDepartments = getScopedDepartments(scope)
  if (scopeDepartments === null) return null
  // A lead may always open their own profile.
  if (userId === scope.userId) return null

  const { data } = await db.from("profiles").select("department").eq("id", userId).maybeSingle()
  if (!data) return notFound("Employee")
  return departmentInScope(scopeDepartments, (data as { department: string | null }).department) ? null : forbidden()
}

/**
 * An asset is in scope when it belongs to a managed department, or its current assignment goes to a
 * managed department, a person in one, or one of that department's offices. This is the same reach the
 * assets list gives a lead, so nothing they can see is blocked.
 */
export async function denyUnlessAssetInScope(
  db: SupabaseClient,
  scope: AdminScope,
  assetId: string
): Promise<NextResponse | null> {
  const scopeDepartments = getScopedDepartments(scope)
  if (scopeDepartments === null) return null

  const { data: asset } = await db.from("assets").select("department").eq("id", assetId).maybeSingle()
  if (!asset) return notFound("Asset")
  if (departmentInScope(scopeDepartments, (asset as { department: string | null }).department)) return null

  const { data: assignment } = await db
    .from("asset_assignments")
    .select("assigned_to, department, office_location")
    .eq("asset_id", assetId)
    .eq("is_current", true)
    .maybeSingle()
  const current = assignment as {
    assigned_to: string | null
    department: string | null
    office_location: string | null
  } | null
  if (!current) return forbidden()

  if (departmentInScope(scopeDepartments, current.department)) return null

  if (current.assigned_to) {
    const { data: assignee } = await db
      .from("profiles")
      .select("department")
      .eq("id", current.assigned_to)
      .maybeSingle()
    if (departmentInScope(scopeDepartments, (assignee as { department: string | null } | null)?.department)) return null
  }

  if (current.office_location) {
    const { data: office } = await db
      .from("office_locations")
      .select("department")
      .eq("name", current.office_location)
      .maybeSingle()
    if (departmentInScope(scopeDepartments, (office as { department: string | null } | null)?.department)) return null
  }

  return forbidden()
}

/**
 * Every asset id `denyUnlessAssetInScope` would let this scope open, worked out in a handful of
 * queries instead of several per asset, for routes that list across assets. `null` means an
 * unrestricted scope (every asset). Throws when a lookup fails, so a failure never widens access.
 */
export async function listAssetIdsInScope(db: SupabaseClient, scope: AdminScope): Promise<string[] | null> {
  const scopeDepartments = getScopedDepartments(scope)
  if (scopeDepartments === null) return null

  const [assetsRes, currentRes, officesRes] = await Promise.all([
    db.from("assets").select("id, department"),
    db.from("asset_assignments").select("asset_id, assigned_to, department, office_location").eq("is_current", true),
    db.from("office_locations").select("name, department"),
  ])
  const failed = assetsRes.error || currentRes.error || officesRes.error
  if (failed) throw failed

  const current = (currentRes.data ?? []) as {
    asset_id: string
    assigned_to: string | null
    department: string | null
    office_location: string | null
  }[]
  const assigneeIds = Array.from(new Set(current.map((c) => c.assigned_to).filter((id): id is string => Boolean(id))))
  const assigneeDept = new Map<string, string | null>()
  if (assigneeIds.length > 0) {
    const { data, error } = await db.from("profiles").select("id, department").in("id", assigneeIds)
    if (error) throw error
    ;((data ?? []) as { id: string; department: string | null }[]).forEach((p) => assigneeDept.set(p.id, p.department))
  }
  const officeDept = new Map(
    ((officesRes.data ?? []) as { name: string; department: string | null }[]).map((o) => [o.name, o.department])
  )
  const currentByAsset = new Map(current.map((c) => [c.asset_id, c]))

  const inScope = (department: string | null | undefined) => departmentInScope(scopeDepartments, department)
  return ((assetsRes.data ?? []) as { id: string; department: string | null }[])
    .filter((asset) => {
      if (inScope(asset.department)) return true
      const c = currentByAsset.get(asset.id)
      if (!c) return false
      return (
        inScope(c.department) ||
        (c.assigned_to ? inScope(assigneeDept.get(c.assigned_to)) : false) ||
        (c.office_location ? inScope(officeDept.get(c.office_location)) : false)
      )
    })
    .map((asset) => asset.id)
}

/** A help desk ticket is in scope when a managed department services it or one of its people raised it. */
export async function denyUnlessTicketInScope(
  db: SupabaseClient,
  scope: AdminScope,
  ticketId: string
): Promise<NextResponse | null> {
  const scopeDepartments = getScopedDepartments(scope)
  if (scopeDepartments === null) return null

  const { data } = await db
    .from("help_desk_tickets")
    .select("service_department, requester_id")
    .eq("id", ticketId)
    .maybeSingle()
  const ticket = data as { service_department: string | null; requester_id: string | null } | null
  if (!ticket) return notFound("Ticket")
  if (departmentInScope(scopeDepartments, ticket.service_department)) return null

  if (ticket.requester_id) {
    const { data: requester } = await db
      .from("profiles")
      .select("department")
      .eq("id", ticket.requester_id)
      .maybeSingle()
    if (departmentInScope(scopeDepartments, (requester as { department: string | null } | null)?.department))
      return null
  }
  return forbidden()
}
