"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Card, CardContent } from "@/components/ui/card"
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

const log = logger("hr-employees-[userId]")

async function fetchEmployeeDetail(userId: string): Promise<EmployeeDetailData> {
  const supabase = createClient()

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  if (profileError) throw new Error(profileError.message)
  if (!profileData) throw new Error("Employee not found")

  const { data: tasksData } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false })

  const { data: deviceAssignments } = await supabase
    .from("device_assignments")
    .select("device_id, assigned_at")
    .eq("assigned_to", userId)
    .eq("is_current", true)

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

  const { data: assetAssignments } = await supabase
    .from("asset_assignments")
    .select("asset_id, assigned_at")
    .eq("assigned_to", userId)
    .eq("is_current", true)

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

  const { data: docsData } = await supabase
    .from("user_documentation")
    .select("id, title, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  const { data: logsData } = await supabase
    .from("audit_logs")
    .select("*")
    .or(`user_id.eq.${userId},entity_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50)

  const { data: feedbackData } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

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

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminEmployeeDetail(userId),
    queryFn: () => fetchEmployeeDetail(userId),
    enabled: !!userId,
  })

  const profile = data?.profile ?? null
  const tasks = data?.tasks ?? []
  const devices = data?.devices ?? []
  const assets = data?.assets ?? []
  const documentation = data?.documentation ?? []
  const auditLogs = data?.auditLogs ?? []
  const feedback = data?.feedback ?? []

  if (isLoading) {
    return <PageLoader />
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Employee not found</p>
            <Button onClick={() => router.push("/admin/hr/employees")} className="mt-4">
              Back to Employees
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase()

  log.debug("Rendering employee detail", { userId, fullName })

  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageHeader
        title={fullName}
        description={profile.company_email}
        backLink={{ href: "/admin/hr/employees", label: "Back to Employees" }}
        actions={
          <Button onClick={() => router.push(`/admin/hr/employees?userId=${userId}`)}>
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
