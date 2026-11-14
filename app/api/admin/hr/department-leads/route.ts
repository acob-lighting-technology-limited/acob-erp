import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { ownerLeadChangeBlock } from "@/lib/admin/edit-grants"
import { scopeCanEditRoute, scopeHoldsAdminRoute } from "@/lib/admin/rbac"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { serverError, validationError } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const log = logger("admin-department-leads")
export const dynamic = "force-dynamic"

type DepartmentRow = { id: string; name: string; department_head_id: string | null }
type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  company_email: string | null
  role: string | null
  department: string | null
  is_department_lead: boolean | null
}

/** Department leads are an org-wide setting: global admins only (not lead mode). */
async function requireGlobalAdmin() {
  const result = await requireApiAdminScope()
  if (!result.ok) return { response: result.response }
  if (
    !result.scope.isAdminLike ||
    result.scope.scopeMode === "lead" ||
    !scopeHoldsAdminRoute(result.scope, "hr.main")
  ) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supabase: result.supabase, scope: result.scope, role: String(result.scope.role) }
}

/**
 * GET /api/admin/hr/department-leads — active departments with their current
 * lead, plus `candidates`: active, non-visitor staff who can be made a lead.
 */
export async function GET() {
  const auth = await requireGlobalAdmin()
  if ("response" in auth) return auth.response
  const db = getServiceRoleClientOrFallback(auth.supabase)

  const [deptRes, leadRes, candidateRes] = await Promise.all([
    db
      .from("departments")
      .select("id, name, department_head_id")
      .eq("is_active", true)
      .order("name")
      .limit(500)
      .returns<DepartmentRow[]>(),
    db
      .from("profiles")
      .select("id, first_name, last_name, company_email, role, department, is_department_lead")
      .eq("is_department_lead", true)
      .limit(500)
      .returns<ProfileRow[]>(),
    db
      .from("profiles")
      .select("id, first_name, last_name, company_email, role, department, is_department_lead")
      .neq("role", "visitor")
      .eq("employment_status", "active")
      .order("first_name")
      .limit(500)
      .returns<ProfileRow[]>(),
  ])
  const failed = deptRes.error ?? leadRes.error ?? candidateRes.error
  if (failed) return serverError(log, failed, "Could not load department leads")

  const leads = leadRes.data ?? []
  const departments = (deptRes.data ?? []).map((dept) => {
    const lead = leads.find((profile) => profile.id === dept.department_head_id)
    return {
      id: dept.id,
      name: dept.name,
      lead_id: lead?.id ?? null,
      lead_name: lead ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : null,
      lead_email: lead?.company_email ?? null,
    }
  })

  return NextResponse.json({
    data: {
      departments,
      candidates: candidateRes.data ?? [],
      canEdit: scopeCanEditRoute(auth.scope, "hr.departments"),
    },
  })
}

const AssignSchema = z.object({
  departmentId: z.string().uuid(),
  userId: z.string().uuid(),
})

/** POST /api/admin/hr/department-leads — make `userId` the lead of `departmentId`. */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-department-leads:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const auth = await requireGlobalAdmin()
  if ("response" in auth) return auth.response
  if (!scopeCanEditRoute(auth.scope, "hr.departments"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // validated below
  }
  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  // Leading an owning department (Admin and HR, Corporate Services, IT and Communications)
  // carries edit access and approval rights, so only a developer or super admin changes it.
  const { data: department } = await getServiceRoleClientOrFallback(auth.supabase)
    .from("departments")
    .select("name")
    .eq("id", parsed.data.departmentId)
    .eq("is_active", true)
    .maybeSingle<{ name: string }>()
  if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 })
  const blocked = ownerLeadChangeBlock({
    actorRole: auth.role,
    before: [],
    after: department?.name ? [department.name] : [],
  })
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })

  const { data: candidate, error: candidateError } = await getServiceRoleClientOrFallback(auth.supabase)
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.userId)
    .eq("employment_status", "active")
    .neq("role", "visitor")
    .maybeSingle()
  if (candidateError) return serverError(log, candidateError)
  if (!candidate) return NextResponse.json({ error: "Choose an active employee." }, { status: 400 })

  // assign_department_lead checks the caller's role from auth.uid(), so it runs
  // with the admin's session rather than the service role.
  const { error } = await auth.supabase.rpc("assign_department_lead", {
    p_department_id: parsed.data.departmentId,
    p_new_lead_id: parsed.data.userId,
  })
  if (error) return serverError(log, error, "Could not assign the department lead")
  await writeAuditLog(
    auth.supabase,
    {
      action: "update",
      entityType: "department",
      entityId: parsed.data.departmentId,
      newValues: { department_head_id: parsed.data.userId },
      context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/hr/department-leads" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireGlobalAdmin()
  if ("response" in auth) return auth.response
  if (!scopeCanEditRoute(auth.scope, "hr.departments"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = AssignSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)
  const { departmentId, userId } = parsed.data
  const db = getServiceRoleClientOrFallback(auth.supabase)
  const { data: department, error: departmentError } = await db
    .from("departments")
    .select("name")
    .eq("id", departmentId)
    .eq("department_head_id", userId)
    .maybeSingle()
  if (departmentError) return serverError(log, departmentError)
  if (!department)
    return NextResponse.json({ error: "The department lead has changed. Refresh and try again." }, { status: 409 })
  const blocked = ownerLeadChangeBlock({ actorRole: auth.role, before: [department.name], after: [] })
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })
  const { data: lead, error: leadError } = await db
    .from("profiles")
    .select("lead_departments")
    .eq("id", userId)
    .eq("is_department_lead", true)
    .maybeSingle<{ lead_departments: string[] | null }>()
  if (leadError) return serverError(log, leadError)
  if (!lead) return NextResponse.json({ error: "Department lead not found" }, { status: 404 })
  const remaining = (lead.lead_departments ?? []).filter((name) => name !== department.name)
  let query = db
    .from("profiles")
    .update({ lead_departments: remaining, is_department_lead: remaining.length > 0 })
    .eq("id", userId)
    .eq("is_department_lead", true)
  query =
    lead.lead_departments === null
      ? query.is("lead_departments", null)
      : query.filter(
          "lead_departments",
          "eq",
          JSON.stringify(lead.lead_departments).replace(/^\[/, "{").replace(/\]$/, "}")
        )
  const { data, error } = await query.select("id").maybeSingle()
  if (error) return serverError(log, error)
  if (!data) return NextResponse.json({ error: "The lead changed. Refresh and try again." }, { status: 409 })
  await writeAuditLog(
    auth.supabase,
    {
      action: "update",
      entityType: "department",
      entityId: departmentId,
      oldValues: { department_head_id: userId },
      newValues: { department_head_id: null },
      context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/hr/department-leads" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}
