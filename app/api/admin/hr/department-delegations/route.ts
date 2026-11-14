import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { scopeCanEditRoute, scopeHoldsAdminRoute } from "@/lib/admin/rbac"
import { serverError, validationError } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { adminDelegationKeys, delegationFields, validDelegationEnd } from "@/lib/dept/admin-delegations"
import { MAX_DEPT_DELEGATION_DAYS } from "@/lib/dept/delegated-pages"
import { ownerLeadChangeBlock } from "@/lib/admin/edit-grants"
import { logger } from "@/lib/logger"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { isSameDepartment } from "@/shared/departments"

const log = logger("admin-department-delegations")
const route = "/api/admin/hr/department-delegations"
const idSchema = z.object({ id: z.string().uuid() })
const editSchema = delegationFields.pick({ pages: true, validUntil: true }).merge(idSchema)

async function authorize(write = false) {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth
  const { scope } = auth
  const canEdit = scopeCanEditRoute(scope, "hr.departments")
  if (
    !scope.isAdminLike ||
    scope.scopeMode === "lead" ||
    !scopeHoldsAdminRoute(scope, "hr.main") ||
    (write && !canEdit)
  ) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ...auth, canEdit, db: getServiceRoleClientOrFallback(auth.supabase) }
}

export async function GET(request: NextRequest) {
  const auth = await authorize()
  if (!auth.ok) return auth.response
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .catch(1)
    .parse(request.nextUrl.searchParams.get("page") ?? 1)
  const size = 25
  const status = request.nextUrl.searchParams.get("status")
  const search = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100)
  const now = new Date().toISOString()
  const fields = "id, department_id, delegator_id, delegate_id, pages, created_at, valid_until, revoked_at"
  const searchRelations =
    "delegate_match:profiles!dept_delegations_delegate_id_fkey(),lead_match:profiles!dept_delegations_delegator_id_fkey(),department_match:departments!dept_delegations_department_id_fkey()"
  let query = auth.db.from("dept_delegations").select(search ? `${fields},${searchRelations}` : fields, {
    count: "exact",
  })
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`
    query = query
      .ilike("delegate_match.full_name", pattern)
      .ilike("lead_match.full_name", pattern)
      .ilike("department_match.name", pattern)
      .or("delegate_match.not.is.null,lead_match.not.is.null,department_match.not.is.null")
  }
  if (status === "active") query = query.is("revoked_at", null).gt("valid_until", now)
  if (status === "expired") query = query.is("revoked_at", null).lte("valid_until", now)
  if (status === "revoked") query = query.not("revoked_at", "is", null)
  const {
    data: rows,
    error,
    count,
  } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * size, page * size - 1)
    .returns<
      Array<{
        id: string
        department_id: string
        delegator_id: string
        delegate_id: string
        pages: string[]
        created_at: string
        valid_until: string
        revoked_at: string | null
      }>
    >()
  if (error) return serverError(log, error)
  const list = rows ?? []
  const ids = list.map((row) => row.id)
  const peopleIds = [...new Set(list.flatMap((row) => [row.delegate_id, row.delegator_id]))]
  const departmentIds = [...new Set(list.map((row) => row.department_id))]
  if (!ids.length) return NextResponse.json({ data: [], total: count ?? 0, canEdit: auth.canEdit })
  const [people, departments, grants] = await Promise.all([
    auth.db.from("profiles").select("id, full_name").in("id", peopleIds).limit(50),
    auth.db.from("departments").select("id, name").in("id", departmentIds).limit(25),
    auth.db.from("admin_edit_grants").select("dept_delegation_id, route_key").in("dept_delegation_id", ids).limit(500),
  ])
  const failure = people.error ?? departments.error ?? grants.error
  if (failure) return serverError(log, failure)
  const names = new Map(people.data?.map((row) => [row.id, row.full_name]))
  const departmentNames = new Map(departments.data?.map((row) => [row.id, row.name]))
  return NextResponse.json({
    data: list.map((row) => ({
      ...row,
      delegate: names.get(row.delegate_id) ?? "Unknown",
      lead: names.get(row.delegator_id) ?? "Unknown",
      department: departmentNames.get(row.department_id) ?? "Unknown",
      adminRoutes: (grants.data ?? [])
        .filter((grant) => grant.dept_delegation_id === row.id)
        .map((grant) => grant.route_key),
    })),
    total: count ?? 0,
    canEdit: auth.canEdit,
  })
}

type Authorized = Extract<Awaited<ReturnType<typeof authorize>>, { ok: true }>

async function audit(
  auth: Authorized,
  id: string,
  action: "create" | "update" | "delete",
  values: Record<string, unknown>
) {
  await writeAuditLog(
    auth.supabase,
    {
      action,
      entityType: "dept_delegation",
      entityId: id,
      newValues: values,
      context: { actorId: auth.scope.userId, source: "api", route },
    },
    { failOpen: true }
  )
}

function invalidEnd() {
  return NextResponse.json(
    { error: `Choose an end time in the next ${MAX_DEPT_DELEGATION_DAYS} days.` },
    { status: 400 }
  )
}

export async function POST(request: NextRequest) {
  const auth = await authorize(true)
  if (!auth.ok) return auth.response
  const parsed = delegationFields.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)
  const { departmentId, delegateId, pages, validUntil } = parsed.data
  if (!validDelegationEnd(validUntil, Date.now())) return invalidEnd()
  const [dept, delegate] = await Promise.all([
    auth.db
      .from("departments")
      .select("name, department_head_id")
      .eq("id", departmentId)
      .eq("is_active", true)
      .maybeSingle(),
    auth.db
      .from("profiles")
      .select("department")
      .eq("id", delegateId)
      .eq("employment_status", "active")
      .neq("role", "visitor")
      .maybeSingle(),
  ])
  if (dept.error || delegate.error) return serverError(log, dept.error ?? delegate.error)
  const head = dept.data?.department_head_id
  if (!dept.data || !head) return NextResponse.json({ error: "Assign a department lead first." }, { status: 400 })
  const blocked = ownerLeadChangeBlock({ actorRole: auth.scope.role, before: [], after: [dept.data.name] })
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })
  if (
    !delegate.data ||
    !isSameDepartment(delegate.data.department, dept.data.name) ||
    delegateId === head ||
    delegateId === auth.scope.userId
  ) {
    return NextResponse.json({ error: "Choose another active employee in this department." }, { status: 400 })
  }
  const values = {
    department_id: departmentId,
    delegator_id: head,
    delegate_id: delegateId,
    pages: [...new Set(pages)],
    valid_until: validUntil,
  }
  const { data, error } = await auth.db.from("dept_delegations").insert(values).select("id").single()
  if (error) return serverError(log, error)
  await audit(auth, data.id, "create", values)
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize(true)
  if (!auth.ok) return auth.response
  const parsed = editSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)
  const { id, pages, validUntil } = parsed.data
  const now = new Date()
  if (!validDelegationEnd(validUntil, now.getTime())) return invalidEnd()
  const [existing, linked] = await Promise.all([
    auth.db
      .from("dept_delegations")
      .select("department_id, pages, valid_until, revoked_at")
      .eq("id", id)
      .maybeSingle<{ department_id: string; pages: string[]; valid_until: string; revoked_at: string | null }>(),
    auth.db.from("admin_edit_grants").select("dept_delegation_id").eq("dept_delegation_id", id).limit(1),
  ])
  if (existing.error || linked.error) return serverError(log, existing.error ?? linked.error)
  if (!existing.data || existing.data.revoked_at || Date.parse(existing.data.valid_until) <= now.getTime()) {
    return NextResponse.json({ error: "Delegation is no longer active." }, { status: 409 })
  }
  if (linked.data?.length || existing.data.pages.some((page) => !adminDelegationKeys.has(page))) {
    return NextResponse.json(
      { error: "This delegation includes Admin access. Revoke it and create a new delegation to change access." },
      { status: 409 }
    )
  }
  const department = await auth.db.from("departments").select("name").eq("id", existing.data.department_id).single()
  if (department.error) return serverError(log, department.error)
  const blocked = ownerLeadChangeBlock({ actorRole: auth.scope.role, before: [], after: [department.data.name] })
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })
  const values = { pages: [...new Set(pages)], valid_until: validUntil }
  const { data, error } = await auth.db
    .from("dept_delegations")
    .update(values)
    .eq("id", id)
    .is("revoked_at", null)
    .eq("valid_until", existing.data.valid_until)
    .gt("valid_until", now.toISOString())
    .select("id")
    .maybeSingle()
  if (error) return serverError(log, error)
  if (!data) return NextResponse.json({ error: "Delegation changed. Refresh and try again." }, { status: 409 })
  await audit(auth, id, "update", values)
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize(true)
  if (!auth.ok) return auth.response
  const parsed = idSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)
  const { id } = parsed.data
  const { data: row, error: readError } = await auth.db
    .from("dept_delegations")
    .select("department_id")
    .eq("id", id)
    .is("revoked_at", null)
    .maybeSingle()
  if (readError) return serverError(log, readError)
  if (!row) return NextResponse.json({ error: "Delegation already revoked or missing." }, { status: 404 })
  const department = await auth.db.from("departments").select("name").eq("id", row.department_id).single()
  if (department.error) return serverError(log, department.error)
  const blocked = ownerLeadChangeBlock({ actorRole: auth.scope.role, before: [department.data.name], after: [] })
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })
  const now = new Date().toISOString()
  const values = { revoked_at: now, revoked_by: auth.scope.userId }
  // Withdraw linked Admin grants first. A retry can safely finish the delegation if that update fails.
  const grants = await auth.db
    .from("admin_edit_grants")
    .update(values)
    .eq("dept_delegation_id", id)
    .is("revoked_at", null)
  if (grants.error) return serverError(log, grants.error)
  const { data, error } = await auth.db
    .from("dept_delegations")
    .update(values)
    .eq("id", id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle()
  if (error) return serverError(log, error)
  if (!data) return NextResponse.json({ error: "Delegation already revoked or missing." }, { status: 404 })
  await audit(auth, id, "delete", values)
  return NextResponse.json({ data })
}
