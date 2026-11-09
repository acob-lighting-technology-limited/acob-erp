import type { SupabaseClient } from "@supabase/supabase-js"
import { GRANTABLE_EDIT_ROUTES, buildAccessContextV2, isEditOwnerV2, type AdminRouteKeyV2 } from "@/lib/admin/policy-v2"
import { resolveAdminScope } from "@/lib/admin/rbac"

/**
 * The edit-guarded routes `userId` may hand on to a delegate: the ones they own as
 * lead of the owning department, plus the ones they hold by an explicit (non-delegated)
 * grant. A route held only by delegation can never be delegated again.
 */
export async function loadDelegableRoutes(client: SupabaseClient, userId: string): Promise<AdminRouteKeyV2[]> {
  const scope = await resolveAdminScope(client, userId)
  if (!scope || !scope.isAdminLike) return []
  const context = buildAccessContextV2(scope)

  const { data } = await client
    .from("admin_edit_grants")
    .select("route_key, valid_until")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .is("delegated_from", null)
    .returns<Array<{ route_key: string; valid_until: string | null }>>()
  const now = Date.now()
  const own = new Set(
    (data ?? [])
      .filter((row) => !row.valid_until || new Date(row.valid_until).getTime() > now)
      .map((row) => row.route_key)
  )

  return GRANTABLE_EDIT_ROUTES.filter((route) => {
    if (isEditOwnerV2(context, route)) return true
    if (own.has(route)) return true
    const umbrella = route === "it.main" || route.startsWith("security.") ? "it.main" : "hr.main"
    return own.has(umbrella)
  })
}
