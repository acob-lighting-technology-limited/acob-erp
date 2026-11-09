import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope, scopeHoldsAdminRoute } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

type KitAccess =
  | { ok: true; userId: string; supabase: SupabaseClient; dataClient: SupabaseClient }
  | { ok: false; status: number; error: string }

/**
 * Starlink kits are company-wide records (account numbers, logins, billing) owned by
 * IT, so only admins holding the IT console route (it.main) may see them. Changing
 * them is further limited to IT edit access by the central check in middleware.
 */
export async function requireStarlinkKitAccess(): Promise<KitAccess> {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !scopeHoldsAdminRoute(scope, "it.main")) {
    return { ok: false, status: 403, error: "IT access is required for Starlink kits" }
  }
  return { ok: true, userId: user.id, supabase, dataClient: getServiceRoleClientOrFallback(supabase) }
}
