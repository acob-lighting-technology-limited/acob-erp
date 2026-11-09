import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveDeptScope, type DeptScope } from "@/lib/dept/scope"
import {
  ADMIN_ONLY_PAGES,
  DEPT_DELEGABLE_PAGE_KEYS,
  MAX_DEPT_DELEGATION_DAYS,
  adminRoutesForPages,
  consolePageKeys,
} from "@/lib/dept/delegated-pages"
import { buildAccessContextV2, GRANTABLE_ADMIN_ROUTES, type AdminRouteKeyV2 } from "@/lib/admin/policy-v2"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { checkEditGrantRequest } from "@/lib/admin/edit-grants"
import { editRouteLabel } from "@/lib/admin/edit-route-labels"
import { loadDelegableRoutes } from "@/lib/admin/delegable-routes"
import { loadOwnGrantRoutes, upsertEditGrants } from "@/lib/admin/edit-grants-store"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/dept/delegations")
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ dept_id: string }> }

const ADMIN_ROLES = ["admin", "super_admin", "developer"]

const CreateSchema = z.object({
  delegateId: z.string().uuid(),
  pages: z.array(z.enum(DEPT_DELEGABLE_PAGE_KEYS as [string, ...string[]])).min(1, "Choose at least one page"),
  validUntil: z.string().datetime({ offset: true }),
})

type NameRow = { id: string; full_name: string | null; first_name: string | null; last_name: string | null }

function nameOf(row: NameRow | undefined) {
  if (!row) return "Unknown"
  return row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unknown"
}

/**
 * Who may manage this department's delegations: its lead. A delegate never can: nobody passes a
 * delegation on.
 */
async function resolveLead(deptId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const scope = await resolveDeptScope(supabase, user.id, deptId)
  if (!scope || scope.delegation) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const, scope: scope as DeptScope, supabase }
}

/**
 * GET: the live delegations for this department, the people the lead can choose from, and the
 * /admin pages this lead is able to pass on (so the dialog can offer them).
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { dept_id } = await params
  const auth = await resolveLead(dept_id)
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth
  const client = getServiceRoleClientOrFallback(supabase)

  const { data: rows, error } = await client
    .from("dept_delegations")
    .select("id, delegate_id, pages, valid_until, created_at")
    .eq("department_id", scope.deptId)
    .is("revoked_at", null)
    .gt("valid_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string; delegate_id: string; pages: string[]; valid_until: string; created_at: string }>>()
  if (error) return serverError(log, error)

  const { data: people, error: peopleError } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name, department, role, employment_status")
    .neq("employment_status", "exited")
    .neq("id", scope.userId)
    .order("full_name", { ascending: true })
    .returns<Array<NameRow & { department: string | null; role: string | null }>>()
  if (peopleError) return serverError(log, peopleError)

  const names = new Map((people ?? []).map((person) => [person.id, nameOf(person)]))
  const delegable = await loadDelegableRoutes(client, scope.userId)

  return NextResponse.json({
    data: {
      delegations: (rows ?? []).map((row) => ({
        id: row.id,
        delegate_id: row.delegate_id,
        delegate_name: names.get(row.delegate_id) ?? "Unknown",
        pages: row.pages,
        valid_until: row.valid_until,
      })),
      candidates: (people ?? []).map((person) => ({
        id: person.id,
        name: nameOf(person),
        department: person.department,
        is_admin: ADMIN_ROLES.includes(String(person.role ?? "")),
      })),
      adminPages: ADMIN_ONLY_PAGES.filter((page) => delegable.includes(page.key as AdminRouteKeyV2)),
      adminRoutes: delegable,
    },
  })
}

/** POST: hand some pages of this department (and the /admin pages that go with them) to someone until a date. */
export async function POST(request: NextRequest, { params }: Params) {
  const rl = await rateLimit(`dept-delegations:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  const { dept_id } = await params
  const auth = await resolveLead(dept_id)
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
  }
  const body = parsed.data

  const validUntil = new Date(body.validUntil)
  const now = new Date()
  if (validUntil.getTime() <= now.getTime()) {
    return NextResponse.json({ error: "The end date must be in the future." }, { status: 400 })
  }
  if ((validUntil.getTime() - now.getTime()) / 86_400_000 > MAX_DEPT_DELEGATION_DAYS) {
    return NextResponse.json(
      { error: `A delegation can last at most ${MAX_DEPT_DELEGATION_DAYS} days.` },
      { status: 400 }
    )
  }
  if (body.delegateId === scope.userId) {
    return NextResponse.json({ error: "You cannot delegate to yourself." }, { status: 400 })
  }

  const client = getServiceRoleClientOrFallback(supabase)
  const { data: delegate } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name, employment_status, role, admin_routes")
    .eq("id", body.delegateId)
    .maybeSingle<NameRow & { employment_status: string | null; role: string | null; admin_routes: string[] | null }>()
  if (!delegate || delegate.employment_status === "exited") {
    return NextResponse.json({ error: "That person cannot be given access." }, { status: 400 })
  }

  // The admin-only pages the lead ticked must be ones this lead can actually pass on.
  const delegable = await loadDelegableRoutes(client, scope.userId)
  const unavailable = ADMIN_ONLY_PAGES.find(
    (page) => body.pages.includes(page.key) && !delegable.includes(page.key as AdminRouteKeyV2)
  )
  if (unavailable) {
    return NextResponse.json({ error: `You cannot delegate ${unavailable.label}.` }, { status: 400 })
  }

  const consoleKeys = consolePageKeys(body.pages)
  const adminRoutes = adminRoutesForPages(body.pages, delegable) as AdminRouteKeyV2[]

  // Work out which /admin pages can really be handed over before anything is written.
  const handedOver: AdminRouteKeyV2[] = []
  const skipped: Array<{ route: string; label: string; reason: string }> = []
  if (adminRoutes.length > 0) {
    const actorScope = await resolveAdminScope(client, scope.userId)
    const actorContext = actorScope ? buildAccessContextV2(actorScope) : null
    const ownGrants = await loadOwnGrantRoutes(client, scope.userId, now)
    const targetAdminRoutes = Array.isArray(delegate.admin_routes)
      ? (delegate.admin_routes.filter((key) =>
          GRANTABLE_ADMIN_ROUTES.includes(key as AdminRouteKeyV2)
        ) as AdminRouteKeyV2[])
      : null
    for (const route of adminRoutes) {
      const problem = actorContext
        ? checkEditGrantRequest({
            mode: "delegate",
            actorId: scope.userId,
            actorRole: scope.role,
            actorContext,
            actorOwnGrantRoutes: ownGrants,
            targetId: delegate.id,
            targetRole: String(delegate.role ?? ""),
            targetAdminRoutes,
            routes: [route],
            validUntil,
            now,
          })
        : "You cannot delegate admin pages."
      if (problem) skipped.push({ route, label: editRouteLabel(route), reason: problem })
      else handedOver.push(route)
    }
  }

  // Nothing at all can be given: say why instead of saving an empty delegation.
  if (consoleKeys.length === 0 && handedOver.length === 0) {
    return NextResponse.json({ error: skipped[0]?.reason ?? "Choose at least one page" }, { status: 400 })
  }

  const { data: created, error } = await client
    .from("dept_delegations")
    .insert({
      department_id: scope.deptId,
      delegator_id: scope.userId,
      delegate_id: delegate.id,
      pages: body.pages,
      valid_until: validUntil.toISOString(),
    })
    .select("id")
    .single<{ id: string }>()
  if (error || !created) return serverError(log, error ?? new Error("insert returned nothing"))

  if (handedOver.length > 0) {
    const { error: grantError } = await upsertEditGrants(client, {
      targetId: delegate.id,
      routes: handedOver,
      validUntil,
      grantedBy: scope.userId,
      delegatedFrom: scope.userId,
      deptDelegationId: created.id,
    })
    if (grantError) return serverError(log, grantError)
  }

  await writeAuditLog(
    supabase,
    {
      action: "create",
      entityType: "dept_delegation",
      entityId: created.id,
      newValues: {
        department: scope.deptName,
        delegate: nameOf(delegate),
        pages: body.pages,
        admin_routes: handedOver,
        valid_until: validUntil.toISOString(),
      },
      context: { actorId: scope.userId, source: "api", route: `/api/dept/${scope.deptId}/delegations` },
    },
    { failOpen: true }
  )

  try {
    await client.rpc("create_notification", {
      p_user_id: delegate.id,
      p_type: "system",
      p_category: "approvals",
      p_title: "You have been given access",
      p_message: `You can now work for ${scope.deptName} until ${validUntil.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}.`,
      p_priority: "normal",
      p_link_url: consoleKeys.length > 0 ? `/dept/${scope.deptId}` : "/admin",
      p_actor_id: scope.userId,
      p_entity_type: "dept_delegation",
      p_entity_id: created.id,
    })
  } catch (notifyError) {
    log.error({ err: String(notifyError), delegationId: created.id }, "Failed to notify delegate")
  }

  return NextResponse.json({ ok: true, skipped })
}

/** DELETE: withdraw a delegation, and the /admin pages that went with it. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { dept_id } = await params
  const auth = await resolveLead(dept_id)
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth

  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("id"))
  if (!id.success) return NextResponse.json({ error: "A delegation id is required" }, { status: 400 })

  const client = getServiceRoleClientOrFallback(supabase)
  const { data: row } = await client
    .from("dept_delegations")
    .select("id, department_id, delegate_id, pages, revoked_at")
    .eq("id", id.data)
    .eq("department_id", scope.deptId)
    .maybeSingle<{
      id: string
      department_id: string
      delegate_id: string
      pages: string[]
      revoked_at: string | null
    }>()
  if (!row || row.revoked_at) return NextResponse.json({ error: "Delegation not found" }, { status: 404 })

  const revokedAt = new Date().toISOString()
  const { error } = await client
    .from("dept_delegations")
    .update({ revoked_at: revokedAt, revoked_by: scope.userId })
    .eq("id", row.id)
  if (error) return serverError(log, error)

  const { error: grantError } = await client
    .from("admin_edit_grants")
    .update({ revoked_at: revokedAt, revoked_by: scope.userId })
    .eq("dept_delegation_id", row.id)
    .is("revoked_at", null)
  if (grantError) return serverError(log, grantError)

  await writeAuditLog(
    supabase,
    {
      action: "delete",
      entityType: "dept_delegation",
      entityId: row.id,
      oldValues: { department: scope.deptName, delegate_id: row.delegate_id, pages: row.pages },
      context: { actorId: scope.userId, source: "api", route: `/api/dept/${scope.deptId}/delegations` },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true })
}
