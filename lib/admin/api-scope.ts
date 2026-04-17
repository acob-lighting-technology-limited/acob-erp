import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope, expandDepartmentScopeForQuery, type AdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"

const log = logger("admin-api-scope")

export type { AdminScope }

/**
 * Reads the AdminScope injected by middleware (x-admin-scope header).
 * This is the PRIMARY way for API route handlers to get scope —
 * no extra DB round-trip. Falls back to resolveApiAdminScope() if the
 * header is absent (e.g. local dev without middleware, or uncovered paths).
 */
export async function getRequestScope(): Promise<AdminScope | null> {
  try {
    const h = await headers()
    const raw = h.get("x-admin-scope")
    if (raw) {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as AdminScope
    }
  } catch {
    // Header absent or malformed — fall through to DB resolution
  }
  return resolveApiAdminScope()
}

/**
 * Resolves the current authenticated user's AdminScope for use in API route
 * handlers. Returns null if the user is unauthenticated or has no admin access.
 * Prefer getRequestScope() in new code — it reads from the middleware header first.
 */
export async function resolveApiAdminScope(): Promise<AdminScope | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const scope = await resolveAdminScope(supabase, user.id)
  return scope
}

/**
 * Resolves the AdminScope and returns a 401/403 NextResponse if the user lacks
 * access. Use this at the start of admin API handlers.
 * Uses getRequestScope() internally — reads the middleware header first.
 *
 * @returns `{ scope, supabase }` on success, or a NextResponse error to return early.
 */
export async function requireApiAdminScope(): Promise<
  | { ok: true; scope: AdminScope; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  // Try header first, fall back to DB
  const scope = await getRequestScope()
  if (!scope) {
    log.warn({ userId: user.id }, "User has no admin scope")
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, scope, supabase }
}

/**
 * Returns an array of department name strings to filter by for a given scope,
 * or null if no department filtering should be applied (i.e. the user can see
 * all departments).
 *
 * Expands aliases (e.g. "Finance" → "Accounts") automatically.
 */
export function getScopedDepartments(scope: AdminScope): string[] | null {
  // Admin-like roles in global mode see everything
  if (scope.isAdminLike && scope.scopeMode !== "lead") return null
  // Non-lead employees should not reach admin APIs, but guard anyway
  if (!scope.isDepartmentLead && !scope.isAdminLike) return []
  // Lead (or admin in lead mode) — return managed departments with aliases
  if (scope.managedDepartments.length === 0) return []
  return expandDepartmentScopeForQuery(scope.managedDepartments)
}

/**
 * Returns an array of department ID strings to filter by.
 * Returns null if unrestricted; empty array if the lead has no mapped IDs.
 */
export function getScopedDepartmentIds(scope: AdminScope): string[] | null {
  if (scope.isAdminLike && scope.scopeMode !== "lead") return null
  if (!scope.isDepartmentLead && !scope.isAdminLike) return []
  return scope.managedDepartmentIds.length > 0 ? scope.managedDepartmentIds : []
}
