import { NextResponse } from "next/server"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { resolveAdminScope, scopeHoldsAdminRoute } from "@/lib/admin/rbac"
import type { AdminRouteKeyV2 } from "@/lib/admin/policy-v2"

export type AdminRoleGuardResult =
  | { error: NextResponse }
  | { supabase: SupabaseClient; user: User; userId: string; role: string }

/**
 * Guard for org-wide admin API routes. Allows developer/super_admin, and an
 * admin only when they hold `route` — an admin is a super_admin scoped to
 * their assigned routes, so holding no grant for the route means no access.
 * Rate-limits per client, then checks the session and route.
 *
 *   const auth = await requireAdminRole(request, "hr.attendance", "admin-attendance-holidays", 20)
 *   if ("error" in auth) return auth.error
 *
 * Department-scoped routes use requireApiAdminScope() instead.
 */
export async function requireAdminRole(
  request: Request,
  route: AdminRouteKeyV2,
  rateKey: string,
  limitPerMinute = 30
): Promise<AdminRoleGuardResult> {
  const rl = await rateLimit(`${rateKey}:${getClientId(request)}`, { limit: limitPerMinute, windowSec: 60 })
  if (!rl.allowed) return { error: NextResponse.json({ error: "Too many requests" }, { status: 429 }) }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !scopeHoldsAdminRoute(scope, route)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supabase, user, userId: user.id, role: scope.role }
}
