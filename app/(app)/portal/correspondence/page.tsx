import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PortalCorrespondenceContent } from "./portal-correspondence-content"

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
    .select("full_name, first_name, last_name, department")
    .eq("id", user.id)
    .single()

  const currentViewerName =
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    user.email ||
    ""

  const { data: records } = await supabase
    .from("correspondence_records")
    .select("*")
    .or(`originator_id.eq.${user.id},responsible_officer_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  const { data: departmentCodes } = await supabase
    .from("correspondence_department_codes")
    .select("department_name, department_code")
    .eq("is_active", true)
    .order("department_name", { ascending: true })

  return {
    userId: user.id,
    currentViewerName,
    currentViewerDepartment: profile?.department || "",
    records: records || [],
    departmentCodes: departmentCodes || [],
  }
}

export default async function PortalCorrespondencePage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return (
    <PortalCorrespondenceContent
      userId={data.userId}
      currentViewerName={data.currentViewerName}
      currentViewerDepartment={data.currentViewerDepartment}
      initialRecords={data.records as any}
      departmentCodes={data.departmentCodes as any}
    />
  )
}
