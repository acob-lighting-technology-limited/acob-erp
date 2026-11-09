import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminRouteKeyV2 } from "@/lib/admin/policy-v2"

/**
 * Writes edit grants / delegations. Shared by the Access page (a developer or super admin grants
 * edit) and by department delegation (a lead hands over /admin pages along with console pages), so
 * both create the same rows the same way. Validation is checkEditGrantRequest's job, not this one's.
 */
export async function upsertEditGrants(
  client: SupabaseClient,
  params: {
    targetId: string
    routes: AdminRouteKeyV2[]
    validUntil: Date | null
    grantedBy: string
    /** Set for a delegation: the person handing their access on. Null for a direct grant. */
    delegatedFrom: string | null
    /** Set when the rows belong to a department delegation, so withdrawing it withdraws these too. */
    deptDelegationId?: string | null
  }
): Promise<{ error: { message: string } | null }> {
  for (const route of params.routes) {
    let existing = client
      .from("admin_edit_grants")
      .select("id")
      .eq("user_id", params.targetId)
      .eq("route_key", route)
      .is("revoked_at", null)
    existing = params.delegatedFrom
      ? existing.eq("delegated_from", params.delegatedFrom)
      : existing.is("delegated_from", null)
    const { data: found } = await existing.limit(1).maybeSingle<{ id: string }>()

    const validUntil = params.validUntil ? params.validUntil.toISOString() : null
    const { error } = found
      ? await client
          .from("admin_edit_grants")
          .update({ valid_until: validUntil, granted_by: params.grantedBy })
          .eq("id", found.id)
      : await client.from("admin_edit_grants").insert({
          user_id: params.targetId,
          route_key: route,
          delegated_from: params.delegatedFrom,
          granted_by: params.grantedBy,
          valid_until: validUntil,
          // Only written for a department delegation, so a plain grant works before that column exists.
          ...(params.deptDelegationId ? { dept_delegation_id: params.deptDelegationId } : {}),
        })
    if (error) return { error }
  }
  return { error: null }
}

/** Routes the person holds through an explicit (non-delegated) grant that has not ended. */
export async function loadOwnGrantRoutes(
  client: SupabaseClient,
  userId: string,
  now: Date
): Promise<AdminRouteKeyV2[]> {
  const { data } = await client
    .from("admin_edit_grants")
    .select("route_key, valid_until")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .is("delegated_from", null)
    .returns<Array<{ route_key: string; valid_until: string | null }>>()
  return (data ?? [])
    .filter((row) => !row.valid_until || new Date(row.valid_until).getTime() > now.getTime())
    .map((row) => row.route_key as AdminRouteKeyV2)
}
