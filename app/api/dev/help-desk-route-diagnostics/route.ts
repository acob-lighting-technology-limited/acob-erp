/**
 * GET /api/dev/help-desk-route-diagnostics
 *
 * Validates help-desk routing prerequisites:
 * - support flow: department lead coverage per service department
 * - procurement flow: department lead + HCS + MD approver availability
 *
 * Protected: developer role only.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

type DiagRow = {
  flow_kind: "support" | "procurement"
  stage_code:
    | "department_lead"
    | "requester_department_lead"
    | "service_department_lead"
    | "head_corporate_services"
    | "managing_director"
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

function isHcsCandidate(profile: any): boolean {
  if (!profile) return false
  const managed = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return (
    (profile.role === "developer" ||
      profile.role === "super_admin" ||
      profile.role === "admin" ||
      profile.is_department_lead) &&
    (profile.department === "Corporate Services" || managed.includes("Corporate Services"))
  )
}

function isMdCandidate(profile: any): boolean {
  if (!profile) return false
  return (
    ((profile.role === "developer" || profile.role === "super_admin" || profile.role === "admin") &&
      profile.department === "Executive Management") ||
    profile.role === "developer" ||
    profile.role === "super_admin"
  )
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

  const [departmentsRes, leadsRes] = await Promise.all([
    admin.from("departments").select("name").order("name"),
    admin
      .from("profiles")
      .select("id, full_name, role, department, is_department_lead, lead_departments, employment_status")
      .eq("employment_status", "active"),
  ])

  if (departmentsRes.error) {
    return NextResponse.json({ error: `Failed to load departments: ${departmentsRes.error.message}` }, { status: 500 })
  }
  if (leadsRes.error) {
    return NextResponse.json({ error: `Failed to load profiles: ${leadsRes.error.message}` }, { status: 500 })
  }

  const departments = (departmentsRes.data || []).map((d: any) => d.name).filter(Boolean)
  const profiles = leadsRes.data || []
  const leadProfiles = profiles.filter((p: any) => p.is_department_lead)
  const multiDepartmentLeadIds = new Set(
    leadProfiles.filter((p: any) => getManagedDepartments(p).length > 1).map((p: any) => p.id)
  )
  const rows: DiagRow[] = []

  for (const departmentName of departments) {
    const leadCandidate = profiles.find((p: any) => isLeadForDepartment(p, departmentName))
    const isConflict = Boolean(leadCandidate?.id && multiDepartmentLeadIds.has(leadCandidate.id))
    rows.push({
      flow_kind: "support",
      stage_code: "department_lead",
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
    const deptLead = profiles.find((p: any) => isLeadForDepartment(p, departmentName))
    const isConflict = Boolean(deptLead?.id && multiDepartmentLeadIds.has(deptLead.id))
    rows.push({
      flow_kind: "procurement",
      stage_code: "requester_department_lead",
      scope: departmentName,
      resolved: Boolean(deptLead) && !isConflict,
      resolved_user_id: deptLead?.id ?? null,
      resolved_name: deptLead?.full_name ?? null,
      fail_reason: !deptLead
        ? `No active department lead for "${departmentName}"`
        : isConflict
          ? `${deptLead.full_name || deptLead.id} is assigned as lead for multiple departments; one person cannot lead more than one department`
          : undefined,
    })
    rows.push({
      flow_kind: "procurement",
      stage_code: "service_department_lead",
      scope: departmentName,
      resolved: Boolean(deptLead) && !isConflict,
      resolved_user_id: deptLead?.id ?? null,
      resolved_name: deptLead?.full_name ?? null,
      fail_reason: !deptLead
        ? `No active department lead for "${departmentName}"`
        : isConflict
          ? `${deptLead.full_name || deptLead.id} is assigned as lead for multiple departments; one person cannot lead more than one department`
          : undefined,
    })
  }

  const hcsCandidate = profiles.find((p: any) => isHcsCandidate(p))
  rows.push({
    flow_kind: "procurement",
    stage_code: "head_corporate_services",
    scope: "global",
    resolved: Boolean(hcsCandidate),
    resolved_user_id: hcsCandidate?.id ?? null,
    resolved_name: hcsCandidate?.full_name ?? null,
    fail_reason: hcsCandidate
      ? undefined
      : "No active HCS approver candidate (Corporate Services lead/admin context) found",
  })

  const mdCandidate = profiles.find((p: any) => isMdCandidate(p))
  rows.push({
    flow_kind: "procurement",
    stage_code: "managing_director",
    scope: "global",
    resolved: Boolean(mdCandidate),
    resolved_user_id: mdCandidate?.id ?? null,
    resolved_name: mdCandidate?.full_name ?? null,
    fail_reason: mdCandidate ? undefined : "No active MD approver candidate found",
  })

  const broken = rows.filter((r) => !r.resolved)
  return NextResponse.json({ results: rows, broken_count: broken.length, total: rows.length })
}
