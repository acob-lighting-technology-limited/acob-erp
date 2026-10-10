import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

type KitAccess =
  | { ok: true; userId: string; supabase: SupabaseClient; dataClient: SupabaseClient }
  | { ok: false; status: number; error: string }

/**
 * Starlink kits are company-wide finance records (account numbers, logins,
 * billing), so only users with org-wide finance access may see or change them.
 */
export async function requireStarlinkKitAccess(): Promise<KitAccess> {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || getDepartmentScope(scope, "finance") !== null) {
    return { ok: false, status: 403, error: "Org-wide finance access is required for Starlink kits" }
  }
  return { ok: true, userId: user.id, supabase, dataClient: getServiceRoleClientOrFallback(supabase) }
}
