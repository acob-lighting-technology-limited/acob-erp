import { NextResponse } from "next/server"
import { requireApiAdminScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/job-descriptions")

export const dynamic = "force-dynamic"

// Profiles for the job-descriptions screen, dept-scoped server-side (replaces the
// old client-side is_department_lead/lead_departments filter).
export async function GET() {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  const db = getServiceRoleClientOrFallback(supabase)

  const userProfile = {
    role: scope.role,
    is_department_lead: scope.isDepartmentLead,
    lead_departments: scope.leadDepartments,
  }

  const depts = getScopedDepartments(scope)
  // Only the fields the job-descriptions screen shows: this list goes to the
  // browser for every employee in scope, so it must not carry personal or HR data.
  let query = db
    .from("profiles")
    .select(
      "id, first_name, last_name, company_email, department, designation, phone_number, role, job_description, job_description_updated_at, created_at"
    )
    .order("last_name", { ascending: true })
  if (depts !== null) {
    if (depts.length === 0) return NextResponse.json({ profiles: [], userProfile })
    query = query.in("department", depts)
  }

  const { data, error } = await query
  if (error) return serverError(log, error)

  return NextResponse.json({ profiles: data ?? [], userProfile })
}
