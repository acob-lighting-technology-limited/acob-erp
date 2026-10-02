import { NextResponse } from "next/server"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { ADMIN_LIKE_ROLES } from "@/lib/role-management"

export type AdminRoleGuardResult =
  | { error: NextResponse }
  | { supabase: SupabaseClient; user: User; userId: string; role: string }

/**
 * Guard for org-wide admin API routes that any admin-like role (admin,
 * super_admin, developer) may call, regardless of admin_routes or lead mode.
 * Rate-limits per client, then checks the session and role.
 *
 *   const auth = await requireAdminRole(request, "admin-attendance-holidays", 20)
 *   if ("error" in auth) return auth.error
 *
 * Department-scoped routes use requireApiAdminScope() instead.
 */
export async function requireAdminRole(
  request: Request,
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = String(profile?.role || "")
  if (!(ADMIN_LIKE_ROLES as readonly string[]).includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supabase, user, userId: user.id, role }
}
