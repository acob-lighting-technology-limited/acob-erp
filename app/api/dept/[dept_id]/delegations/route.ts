import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveDeptScope, type DeptScope } from "@/lib/dept/scope"
import { DEPT_DELEGABLE_PAGE_KEYS, MAX_DEPT_DELEGATION_DAYS } from "@/lib/dept/delegated-pages"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/dept/delegations")
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ dept_id: string }> }

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
 * Who may manage this department's delegations: its lead. A delegate never can (nobody passes
 * a delegation on), and developers / super admins may withdraw one on any department.
 */
async function resolveLead(deptId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user)
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const scope = await resolveDeptScope(supabase, user.id, deptId)
  if (!scope || scope.delegation) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const, scope: scope as DeptScope, supabase }
}

/** GET: the live delegations for this department, plus the people the lead can choose from. */
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
    .select("id, full_name, first_name, last_name, department, employment_status")
    .neq("employment_status", "exited")
    .neq("id", scope.userId)
    .order("full_name", { ascending: true })
    .returns<Array<NameRow & { department: string | null }>>()
  if (peopleError) return serverError(log, peopleError)

  const names = new Map((people ?? []).map((person) => [person.id, nameOf(person)]))

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
      })),
    },
  })
}

/** POST: hand some pages of this department to someone until a date. */
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
  const now = Date.now()
  if (validUntil.getTime() <= now)
    return NextResponse.json({ error: "The end date must be in the future." }, { status: 400 })
  if ((validUntil.getTime() - now) / 86_400_000 > MAX_DEPT_DELEGATION_DAYS) {
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
    .select("id, full_name, first_name, last_name, employment_status")
    .eq("id", body.delegateId)
    .maybeSingle<NameRow & { employment_status: string | null }>()
  if (!delegate || delegate.employment_status === "exited") {
    return NextResponse.json({ error: "That person cannot be given access." }, { status: 400 })
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
      p_message: `You can now work in the ${scope.deptName} department console (${body.pages.length} page${body.pages.length === 1 ? "" : "s"}) until ${validUntil.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}.`,
      p_priority: "normal",
      p_link_url: `/dept/${scope.deptId}`,
      p_actor_id: scope.userId,
      p_entity_type: "dept_delegation",
      p_entity_id: created.id,
    })
  } catch (notifyError) {
    log.error({ err: String(notifyError), delegationId: created.id }, "Failed to notify delegate")
  }

  return NextResponse.json({ ok: true })
}

/** DELETE: withdraw a delegation. */
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

  const { error } = await client
    .from("dept_delegations")
    .update({ revoked_at: new Date().toISOString(), revoked_by: scope.userId })
    .eq("id", row.id)
  if (error) return serverError(log, error)

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
