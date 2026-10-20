import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { normalizeDepartmentName } from "@/shared/departments"
import { formValidation } from "@/lib/validation"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { normalizeDateToISO } from "@/lib/utils/date"
import { serverError, validationError } from "@/lib/api/errors"
import type { Database } from "@/types/database"

const log = logger("admin-hr-employee-profile")
export const dynamic = "force-dynamic"

function isManageUsersRole(role: string | null | undefined): boolean {
  return role === "developer" || role === "super_admin" || role === "admin"
}

/**
 * GET returns the full profile row (joined with contract_categories(code)) for the
 * employee3 edit dialog and for the pre-save diff check — the two reads the original
 * employees page used to do with a raw browser Supabase client, which is not allowed
 * from admin client components (bypasses middleware scope injection).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike && !scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params
  const db = getServiceRoleClientOrFallback(supabase)

  const { data: profile, error } = await db
    .from("profiles")
    .select("*, contract_categories(code)")
    .eq("id", userId)
    .single()

  if (error || !profile) {
    if (error) log.error({ err: error.message }, "employee profile read failed")
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  return NextResponse.json({ data: profile })
}

const UpdateEmployeeProfileSchema = z.object({
  role: z.enum(["visitor", "employee", "admin", "super_admin", "developer"]),
  admin_routes: z.array(z.string()).nullable().optional(),
  department: z.string(),
  office_location: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  is_department_lead: z.boolean(),
  lead_departments: z.array(z.string()).optional(),
  first_name: z.string(),
  last_name: z.string(),
  other_names: z.string().nullable().optional(),
  company_email: z.string().trim().toLowerCase(),
  additional_email: z.string().trim().toLowerCase().nullable().optional(),
  personal_email: z.string().trim().toLowerCase().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  additional_phone: z.string().nullable().optional(),
  residential_address: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  birth_year: z.union([z.string(), z.number()]).nullable().optional(),
  employment_date: z.string().nullable().optional(),
  confirmation_date: z.string().nullable().optional(),
  job_description: z.string().nullable().optional(),
  attendance_exempt: z.boolean().optional(),
  nysc_cds_day: z.string().nullable().optional(),
})

/**
 * PATCH applies the general profile edit — role, department, personal details, etc.
 * Employment status/suspension/exit changes go through /api/v1/hr/employees/[id]/status, and
 * employment-type/contract-category conversion through /api/admin/employees/convert-type, as
 * in the original employees page; this endpoint only owns what that page wrote via a direct
 * `profiles` update.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const rl = await rateLimit(`admin-hr-employee-profile:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!isManageUsersRole(scope.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params
  const parsed = UpdateEmployeeProfileSchema.safeParse(await request.json())
  if (!parsed.success) return validationError(parsed.error.issues)
  const body = parsed.data

  if (!formValidation.isCompanyEmail(body.company_email)) {
    return NextResponse.json({ error: "Valid company email is required" }, { status: 400 })
  }

  const db = getServiceRoleClientOrFallback(supabase)

  const { data: currentProfile, error: fetchErr } = await db
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single<{ role: string | null }>()

  if (fetchErr || !currentProfile) {
    return NextResponse.json(
      { error: "Could not retrieve current employee record for verification" },
      {
        status: 404,
      }
    )
  }

  if (scope.userId === userId && body.role !== currentProfile.role) {
    return NextResponse.json({ error: "You cannot change your own role from the HR employee editor" }, { status: 403 })
  }

  const canonicalDepartment = normalizeDepartmentName(body.department) || ""

  // A lead may hold several departments. Fall back to the home department so an
  // older client that omits the field keeps the lead's existing single entry
  // rather than clearing it. departments.department_head_id is maintained by
  // trg_enforce_single_department_lead, so it is deliberately not written here.
  const leadDepartments = body.is_department_lead
    ? Array.from(
        new Set(
          (body.lead_departments?.length ? body.lead_departments : [canonicalDepartment])
            .map((name) => normalizeDepartmentName(name) || "")
            .filter((name) => name !== "")
        )
      )
    : []

  if (body.is_department_lead && leadDepartments.length === 0) {
    return NextResponse.json({ error: "A department lead must lead at least one department" }, { status: 400 })
  }

  let departmentId: string | null = null
  if (canonicalDepartment) {
    const { data: deptRow } = await db.from("departments").select("id").eq("name", canonicalDepartment).maybeSingle()
    departmentId = deptRow?.id || null
  }

  const updateData: Database["public"]["Tables"]["profiles"]["Update"] = {
    role: body.role,
    admin_routes: body.role === "admin" ? (body.admin_routes ?? null) : null,
    department: canonicalDepartment || null,
    department_id: departmentId,
    office_location: body.office_location || null,
    designation: body.designation || null,
    is_department_lead: body.is_department_lead,
    lead_departments: leadDepartments,
    updated_at: new Date().toISOString(),
    first_name: body.first_name || "",
    last_name: body.last_name || "",
    other_names: body.other_names || null,
    company_email: body.company_email,
    additional_email: body.additional_email || null,
    phone_number: body.phone_number || null,
    additional_phone: body.additional_phone || null,
    residential_address: body.residential_address || null,
    birthday: body.birthday || null,
    birth_year: body.birth_year ? Number(body.birth_year) : null,
    employment_date: normalizeDateToISO(body.employment_date),
    confirmation_date: normalizeDateToISO(body.confirmation_date),
    job_description: body.job_description || null,
  }

  ;(updateData as Record<string, unknown>).attendance_exempt = Boolean(body.attendance_exempt)
  ;(updateData as Record<string, unknown>).personal_email = body.personal_email || null
  if (body.nysc_cds_day !== undefined) {
    ;(updateData as Record<string, unknown>).nysc_cds_day = body.nysc_cds_day || null
  }

  const { error: updateError } = await db.from("profiles").update(updateData).eq("id", userId)
  if (updateError) return serverError(log, updateError, "Could not update the employee")

  const { data: updatedProfile, error: refetchError } = await db
    .from("profiles")
    .select("*, contract_categories(code)")
    .eq("id", userId)
    .single()

  if (refetchError || !updatedProfile) {
    log.error({ err: refetchError }, "profile updated but refetch failed")
  }

  await writeAuditLog(
    supabase,
    {
      action: "update",
      entityType: "profile",
      entityId: userId,
      newValues: updateData as unknown as Record<string, unknown>,
      context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/employees/[userId]/profile" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ data: updatedProfile ?? null })
}
