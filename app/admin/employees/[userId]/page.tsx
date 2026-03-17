"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { formatName } from "@/lib/utils"
import { Edit } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { PageLoader } from "@/components/ui/query-states"
import { EmployeeProfileCard } from "@/components/employees/EmployeeProfileCard"
import { EmployeeDetailTabs } from "@/components/employees/EmployeeDetailTabs"
import type { EmployeeDetailData } from "@/components/employees/employee-detail-types"

import { logger } from "@/lib/logger"

const log = logger("employees-[userId]")

async function fetchEmployeeDetail(userId: string): Promise<EmployeeDetailData> {
  const supabase = createClient()

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  if (profileError) throw new Error(profileError.message)

  const [
    { data: tasksData },
    { data: deviceAssignments },
    { data: assetAssignments },
    { data: docsData },
    { data: logsData },
    { data: feedbackData },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("assigned_to", userId).order("created_at", { ascending: false }),
    supabase
      .from("device_assignments")
      .select("device_id, assigned_at")
      .eq("assigned_to", userId)
      .eq("is_current", true),
    supabase.from("asset_assignments").select("asset_id, assigned_at").eq("assigned_to", userId).eq("is_current", true),
    supabase
      .from("user_documentation")
      .select("id, title, category, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("*")
      .or(`user_id.eq.${userId},entity_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("feedback").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ])

  let devices: EmployeeDetailData["devices"] = []
  if (deviceAssignments && deviceAssignments.length > 0) {
    const deviceIds = deviceAssignments.map((da) => da.device_id)
    const { data: devicesData } = await supabase.from("devices").select("*").in("id", deviceIds)
    if (devicesData) {
      devices = devicesData.map((device) => {
        const assignment = deviceAssignments.find((da) => da.device_id === device.id)
        return { ...device, assigned_at: assignment?.assigned_at || device.created_at }
      })
    }
  }

  let assets: EmployeeDetailData["assets"] = []
  if (assetAssignments && assetAssignments.length > 0) {
    const assetIds = assetAssignments.map((aa) => aa.asset_id)
    const { data: assetsData } = await supabase.from("assets").select("*").in("id", assetIds).is("deleted_at", null)
    if (assetsData) {
      assets = assetsData.map((asset) => {
        const assignment = assetAssignments.find((aa) => aa.asset_id === asset.id)
        return { ...asset, assigned_at: assignment?.assigned_at || asset.created_at }
      })
    }
  }

  return {
    profile: profileData,
    tasks: tasksData || [],
    devices,
    assets,
    documentation: docsData || [],
    auditLogs: logsData || [],
    feedback: feedbackData || [],
  }
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params?.userId as string

  const { data: pageData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminEmployeeDetail(userId),
    queryFn: () => fetchEmployeeDetail(userId),
    enabled: Boolean(userId),
  })

  const profile = pageData?.profile ?? null
  const tasks = pageData?.tasks ?? []
  const devices = pageData?.devices ?? []
  const assets = pageData?.assets ?? []
  const documentation = pageData?.documentation ?? []
  const auditLogs = pageData?.auditLogs ?? []
  const feedback = pageData?.feedback ?? []

  if (isLoading) return <PageLoader />
  if (!profile) return null

  const fullName = `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase()

  log.debug("Rendering employee detail", { userId, fullName })

  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageHeader
        title={fullName}
        description={profile.company_email}
        backLink={{ href: "/admin/employees", label: "Back to Employees" }}
        actions={
          <Button onClick={() => router.push(`/admin/employees?userId=${userId}`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        }
      />

      <EmployeeProfileCard profile={profile} fullName={fullName} initials={initials} />

      <EmployeeDetailTabs
        tasks={tasks}
        devices={devices}
        assets={assets}
        documentation={documentation}
        auditLogs={auditLogs}
        feedback={feedback}
        taskLinkBase="/admin/tasks"
        deviceLinkBase="/admin/devices"
        assetLinkBase="/admin/assets"
        docLinkBase="/admin/documentation/internal"
        feedbackLinkBase="/admin/feedback"
        auditLinkBase="/admin/audit-logs"
      />
    </div>
  )
}
