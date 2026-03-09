/**
 * GET /api/dev/task-route-diagnostics
 *
 * Validates task routing/notification prerequisites:
 * - each department has an active lead (for lead visibility/management)
 * - each department has active members (for department-assigned tasks)
 *
 * Protected: developer role only.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"

type DiagRow = {
  check_code: "department_lead_coverage" | "department_assignment_target"
  scope: string
  resolved: boolean
  resolved_user_id?: string | null
  resolved_name?: string | null
  fail_reason?: string
}

function getManagedDepartments(profile: any): string[] {
  const managed = Array.isArray(profile?.lead_departments) ? profile.lead_departments.filter(Boolean) : []
  const withPrimary = profile?.department ? [profile.department, ...managed] : managed
  return Array.from(new Set(withPrimary))
}

function isLeadForDepartment(profile: any, departmentName: string): boolean {
  if (!profile?.is_department_lead) return false
  return getManagedDepartments(profile).includes(departmentName)
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: actorProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (actorProfile?.role !== "developer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 })
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const [departmentsRes, profilesRes] = await Promise.all([
    admin.from("departments").select("name").order("name"),
    applyAssignableStatusFilter(
      admin
        .from("profiles")
        .select("id, full_name, department, is_department_lead, lead_departments, employment_status"),
      { allowLegacyNullStatus: false }
    ),
  ])

  if (departmentsRes.error) {
    return NextResponse.json({ error: `Failed to load departments: ${departmentsRes.error.message}` }, { status: 500 })
  }
  if (profilesRes.error) {
    return NextResponse.json({ error: `Failed to load profiles: ${profilesRes.error.message}` }, { status: 500 })
  }

  const departments = (departmentsRes.data || []).map((d: any) => d.name).filter(Boolean)
  const profiles = profilesRes.data || []
  const leadProfiles = profiles.filter((p: any) => p.is_department_lead)
  const multiDepartmentLeadIds = new Set(
    leadProfiles.filter((p: any) => getManagedDepartments(p).length > 1).map((p: any) => p.id)
  )
  const rows: DiagRow[] = []

  for (const departmentName of departments) {
    const leadCandidate = profiles.find((p: any) => isLeadForDepartment(p, departmentName))
    const isConflict = Boolean(leadCandidate?.id && multiDepartmentLeadIds.has(leadCandidate.id))
    rows.push({
      check_code: "department_lead_coverage",
      scope: departmentName,
      resolved: Boolean(leadCandidate) && !isConflict,
      resolved_user_id: leadCandidate?.id ?? null,
      resolved_name: leadCandidate?.full_name ?? null,
      fail_reason: !leadCandidate
        ? `No active department lead for "${departmentName}"`
        : isConflict
          ? `${leadCandidate.full_name || leadCandidate.id} is assigned as lead for multiple departments; one person cannot lead more than one department`
          : undefined,
    })
  }

  for (const departmentName of departments) {
    const members = profiles.filter((p: any) => p.department === departmentName)
    rows.push({
      check_code: "department_assignment_target",
      scope: departmentName,
      resolved: members.length > 0,
      resolved_user_id: null,
      resolved_name: null,
      fail_reason:
        members.length > 0 ? undefined : `No active users in "${departmentName}" for department task assignment`,
    })
  }

  const broken = rows.filter((r) => !r.resolved)
  return NextResponse.json({ results: rows, broken_count: broken.length, total: rows.length })
}
