import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import {
  buildAccessContextV2,
  GRANTABLE_ADMIN_ROUTES,
  GRANTABLE_EDIT_ROUTES,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"
import { canRevokeEditGrant, checkEditGrantRequest } from "@/lib/admin/edit-grants"
import { loadOwnGrantRoutes, upsertEditGrants } from "@/lib/admin/edit-grants-store"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/access/grants")
export const dynamic = "force-dynamic"

const ROUTE_ENUM = GRANTABLE_EDIT_ROUTES as unknown as [string, ...string[]]

const CreateSchema = z.object({
  mode: z.enum(["grant", "delegate"]),
  userId: z.string().uuid(),
  routes: z.array(z.enum(ROUTE_ENUM)).min(1, "Choose at least one area"),
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
})

const RevokeSchema = z.object({ id: z.string().uuid() })

type GrantRow = {
  id: string
  user_id: string
  route_key: string
  delegated_from: string | null
  granted_by: string | null
  valid_until: string | null
  revoked_at: string | null
  created_at: string
}

type NameRow = { id: string; full_name: string | null; first_name: string | null; last_name: string | null }

function nameOf(row: NameRow | undefined) {
  if (!row) return "Unknown"
  return row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unknown"
}

/**
 * GET: active edit grants and delegations.
 * Developers and super admins see all of them; everyone else sees only the ones they
 * received, gave or delegated.
 */
export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const client = getServiceRoleClientOrFallback(supabase)
  let query = client
    .from("admin_edit_grants")
    .select("id, user_id, route_key, delegated_from, granted_by, valid_until, revoked_at, created_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })

  const seesAll = scope.role === "developer" || scope.role === "super_admin"
  if (!seesAll) {
    query = query.or(`user_id.eq.${scope.userId},granted_by.eq.${scope.userId},delegated_from.eq.${scope.userId}`)
  }

  const { data, error } = await query.returns<GrantRow[]>()
  if (error) return serverError(log, error)

  const now = Date.now()
  const rows = (data ?? []).filter((row) => !row.valid_until || new Date(row.valid_until).getTime() > now)
  const ids = Array.from(
    new Set(rows.flatMap((row) => [row.user_id, row.delegated_from, row.granted_by].filter(Boolean) as string[]))
  )
  const names = new Map<string, NameRow>()
  if (ids.length > 0) {
    const { data: people } = await client
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", ids)
      .returns<NameRow[]>()
    for (const person of people ?? []) names.set(person.id, person)
  }

  return NextResponse.json({
    data: rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: nameOf(names.get(row.user_id)),
      route_key: row.route_key,
      source: row.delegated_from ? "delegation" : "grant",
      given_by_name: nameOf(names.get(row.delegated_from ?? row.granted_by ?? "")),
      valid_until: row.valid_until,
      created_at: row.created_at,
      can_revoke: canRevokeEditGrant({ actorId: scope.userId, actorRole: scope.role, row }),
    })),
  })
}

/** POST: grant edit (developer / super admin) or delegate your own edit (until a date). */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-edit-grants:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth
  if (!scope.isAdminLike || scope.delegated) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
  }
  const body = parsed.data
  const routes = body.routes as AdminRouteKeyV2[]
  const client = getServiceRoleClientOrFallback(supabase)
  const now = new Date()

  const { data: target } = await client
    .from("profiles")
    .select("id, role, admin_routes, full_name")
    .eq("id", body.userId)
    .maybeSingle<{ id: string; role: string | null; admin_routes: string[] | null; full_name: string | null }>()
  if (!target) return NextResponse.json({ error: "Person not found" }, { status: 404 })

  const actorOwnGrantRoutes = await loadOwnGrantRoutes(client, scope.userId, now)

  const validUntil = body.validUntil ? new Date(body.validUntil) : null
  const problem = checkEditGrantRequest({
    mode: body.mode,
    actorId: scope.userId,
    actorRole: String(scope.role),
    actorContext: buildAccessContextV2(scope),
    actorOwnGrantRoutes,
    targetId: target.id,
    targetRole: String(target.role ?? ""),
    targetAdminRoutes: Array.isArray(target.admin_routes)
      ? (target.admin_routes.filter((key) =>
          GRANTABLE_ADMIN_ROUTES.includes(key as AdminRouteKeyV2)
        ) as AdminRouteKeyV2[])
      : null,
    routes,
    validUntil,
    now,
  })
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const delegatedFrom = body.mode === "delegate" ? scope.userId : null
  const { error } = await upsertEditGrants(client, {
    targetId: target.id,
    routes,
    validUntil,
    grantedBy: scope.userId,
    delegatedFrom,
  })
  if (error) return serverError(log, error)

  await writeAuditLog(
    supabase,
    {
      action: "create",
      entityType: "admin_edit_grant",
      entityId: target.id,
      newValues: {
        mode: body.mode,
        routes,
        valid_until: validUntil?.toISOString() ?? null,
        target_name: target.full_name,
      },
      context: { actorId: scope.userId, source: "api", route: "/api/admin/access/grants" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true })
}

/** DELETE: withdraw a grant or delegation. */
export async function DELETE(request: NextRequest) {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = RevokeSchema.safeParse({ id: request.nextUrl.searchParams.get("id") })
  if (!parsed.success) return NextResponse.json({ error: "A grant id is required" }, { status: 400 })

  const client = getServiceRoleClientOrFallback(supabase)
  const { data: row } = await client
    .from("admin_edit_grants")
    .select("id, user_id, route_key, granted_by, delegated_from, revoked_at")
    .eq("id", parsed.data.id)
    .maybeSingle<GrantRow>()
  if (!row || row.revoked_at) return NextResponse.json({ error: "Grant not found" }, { status: 404 })

  if (!canRevokeEditGrant({ actorId: scope.userId, actorRole: String(scope.role), row })) {
    return NextResponse.json({ error: "You cannot withdraw this access." }, { status: 403 })
  }

  const { error } = await client
    .from("admin_edit_grants")
    .update({ revoked_at: new Date().toISOString(), revoked_by: scope.userId })
    .eq("id", row.id)
  if (error) return serverError(log, error)

  await writeAuditLog(
    supabase,
    {
      action: "delete",
      entityType: "admin_edit_grant",
      entityId: row.user_id,
      oldValues: { route_key: row.route_key, delegated_from: row.delegated_from },
      context: { actorId: scope.userId, source: "api", route: "/api/admin/access/grants" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true })
}
