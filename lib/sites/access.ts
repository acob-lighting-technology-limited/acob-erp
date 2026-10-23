import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope, scopeHoldsAdminRoute } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

type SiteAccess =
  | { ok: true; userId: string; supabase: SupabaseClient; dataClient: SupabaseClient; canEdit: boolean }
  | { ok: false; status: number; error: string }

/**
 * The Sites register is read by all staff and changed only by admins who hold
 * the Portfolios section. Reads and writes both use the service-role
 * client; the tables' own RLS admits admins only, as a backstop for the
 * direct PostgREST path.
 */
export async function resolveSiteAccess({ requireEdit }: { requireEdit: boolean }): Promise<SiteAccess> {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }

  const scope = await resolveAdminScope(supabase, user.id)
  // The register sits under the Portfolios admin section, so editing follows
  // that grant: developer/super_admin always, an admin only with portfolios.main.
  const canEdit = Boolean(scope && scopeHoldsAdminRoute(scope, "portfolios.main"))
  if (requireEdit && !canEdit) return { ok: false, status: 403, error: "Only admins can change the Sites register" }

  return { ok: true, userId: user.id, supabase, dataClient: getServiceRoleClientOrFallback(supabase), canEdit }
}
