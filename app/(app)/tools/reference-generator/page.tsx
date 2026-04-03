import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PortalReferenceGeneratorContent } from "./portal-reference-generator-content"
import type { CorrespondenceRecord } from "@/types/correspondence"

interface DepartmentCodeOption {
  department_name: string
  department_code: string
}

interface ProfileRow {
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
  role: string | null
  lead_departments: string[] | null
  is_department_lead: boolean | null
}

async function getData() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { redirectTo: "/auth/login" as const }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name, department, role, lead_departments, is_department_lead")
    .eq("id", user.id)
    .single<ProfileRow>()

  const currentViewerName =
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    user.email ||
    ""

  const { data: records } = await supabase
    .from("correspondence_records")
    .select("*")
    .returns<CorrespondenceRecord[]>()
    .order("created_at", { ascending: false })

  const role = profile?.role || ""
  const isDeptLead = Boolean(profile?.is_department_lead)
  const managedDepartments = Array.from(
    new Set(
      [...(Array.isArray(profile?.lead_departments) ? profile.lead_departments : []), profile?.department].filter(
        Boolean
      )
    )
  )
  const scopedRecords = (records || []).filter((record) => {
    if (record.originator_id === user.id || record.responsible_officer_id === user.id) return true
    if (["developer", "admin", "super_admin"].includes(role)) return true
    if (isDeptLead) {
      return (
        managedDepartments.includes(record.department_name) ||
        managedDepartments.includes(record.assigned_department_name)
      )
    }
    return false
  })

  const { data: departmentCodes } = await supabase
    .from("correspondence_department_codes")
    .select("department_name, department_code")
    .eq("is_active", true)
    .order("department_name", { ascending: true })
    .returns<DepartmentCodeOption[]>()

  return {
    userId: user.id,
    currentViewerRole: role,
    isDepartmentLead: isDeptLead,
    currentViewerName,
    currentViewerDepartment: profile?.department || "",
    records: scopedRecords || [],
    departmentCodes: departmentCodes || [],
  }
}

export default async function ToolsReferenceGeneratorPage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return (
    <PortalReferenceGeneratorContent
      userId={data.userId}
      currentViewerRole={data.currentViewerRole}
      isDepartmentLead={data.isDepartmentLead}
      currentViewerName={data.currentViewerName}
      currentViewerDepartment={data.currentViewerDepartment}
      initialRecords={data.records}
      departmentCodes={data.departmentCodes}
    />
  )
}
