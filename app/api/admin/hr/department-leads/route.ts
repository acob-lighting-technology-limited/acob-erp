import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { serverError, validationError } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const log = logger("admin-department-leads")
export const dynamic = "force-dynamic"

type DepartmentRow = { id: string; name: string }
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
  if (!result.scope.isAdminLike || result.scope.scopeMode === "lead") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supabase: result.supabase }
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
    db.from("departments").select("id, name").eq("is_active", true).order("name").returns<DepartmentRow[]>(),
    db
      .from("profiles")
      .select("id, first_name, last_name, company_email, role, department, is_department_lead")
      .eq("is_department_lead", true)
      .returns<ProfileRow[]>(),
    db
      .from("profiles")
      .select("id, first_name, last_name, company_email, role, department, is_department_lead")
      .neq("role", "visitor")
      .eq("employment_status", "active")
      .order("first_name")
      .returns<ProfileRow[]>(),
  ])
  const failed = deptRes.error ?? leadRes.error ?? candidateRes.error
  if (failed) return serverError(log, failed, "Could not load department leads")

  const leads = leadRes.data ?? []
  const departments = (deptRes.data ?? []).map((dept) => {
    const lead = leads.find((profile) => profile.department === dept.name)
    return {
      id: dept.id,
      name: dept.name,
      lead_id: lead?.id ?? null,
      lead_name: lead ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : null,
      lead_email: lead?.company_email ?? null,
    }
  })

  return NextResponse.json({ data: { departments, candidates: candidateRes.data ?? [] } })
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

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // validated below
  }
  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  // assign_department_lead checks the caller's role from auth.uid(), so it runs
  // with the admin's session rather than the service role.
  const { error } = await auth.supabase.rpc("assign_department_lead", {
    p_department_id: parsed.data.departmentId,
    p_new_lead_id: parsed.data.userId,
  })
  if (error) return serverError(log, error, "Could not assign the department lead")
  return NextResponse.json({ ok: true })
}
