"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { PageLoader, QueryError } from "@/components/ui/query-states"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { ApprovalFlowBuilderCard } from "@/components/leave/approval-flow-builder-card"
import { LeavePolicyCard, type PolicyFormState } from "@/components/leave/leave-policy-card"
import { HolidayCalendarCard, type HolidayFormState } from "@/components/leave/holiday-calendar-card"
import { ApprovalSlaCard } from "@/components/leave/approval-sla-card"
import { DataQualityCard } from "@/components/leave/data-quality-card"

interface LeaveType {
  id: string
  name: string
}

interface LeavePolicy {
  id: string
  leave_type_id: string
  annual_days: number
  eligibility: "all" | "female_only" | "male_only" | "custom"
  min_tenure_months: number
  notice_days: number
  accrual_mode: "calendar_days" | "business_days"
  leave_type?: { name: string }
}

interface FlowRole {
  code: string
  name: string
  description?: string | null
  resolution_mode: "fixed_user" | "department_lead" | "rule_based"
  is_active: boolean
}

interface FlowRoute {
  requester_kind: "employee" | "dept_lead" | "admin_hr_lead" | "hcs" | "md"
  stage_order: number
  approver_role_code: string
  is_active: boolean
}

interface FlowAssignment {
  approver_role_code: string
  user_id: string
  scope_type: "global" | "department" | "office"
  scope_value?: string | null
  is_primary: boolean
  is_active: boolean
}

interface FlowHealth {
  admin_hr_lead_count: number
  md_count: number
  hcs_count: number
  employee_stage_count: number
  dept_lead_stage_count: number
  admin_hr_lead_stage_count: number
  hcs_stage_count: number
  md_stage_count: number
  is_configured: boolean
}

async function fetchLeaveSettingsData() {
  const [typesRes, policyRes, holidayRes, slaRes, qualityRes, flowRes] = await Promise.all([
    fetch("/api/hr/leave/types"),
    fetch("/api/hr/leave/policies"),
    fetch("/api/hr/leave/holidays"),
    fetch("/api/hr/leave/sla"),
    fetch("/api/hr/leave/data-quality"),
    fetch("/api/hr/leave/flow"),
  ])
  if (!typesRes.ok) throw new Error("Failed to load leave types")

  const [typesPayload, policyPayload, holidayPayload, slaPayload, qualityPayload, flowPayload] = await Promise.all([
    typesRes.json(),
    policyRes.json(),
    holidayRes.json(),
    slaRes.json(),
    qualityRes.json(),
    flowRes.json(),
  ])
  return { typesPayload, policyPayload, holidayPayload, slaPayload, qualityPayload, flowPayload }
}

export default function LeaveSettingsPage() {
  const queryClient = useQueryClient()

  const {
    data: settingsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.leavePolicies(),
    queryFn: fetchLeaveSettingsData,
  })

  const leaveTypes: LeaveType[] = settingsData?.typesPayload?.data || []
  const policies: LeavePolicy[] = settingsData?.policyPayload?.data || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holidays: any[] = settingsData?.holidayPayload?.data || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slas: any[] = settingsData?.slaPayload?.data || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataQuality: any[] = settingsData?.qualityPayload?.data || []
  const flowHealth: FlowHealth | null = settingsData?.flowPayload?.data?.health || null
  const canEditFlow: boolean = Boolean(settingsData?.flowPayload?.permissions?.can_edit)

  const [flowRoles, setFlowRoles] = useState<FlowRole[]>([])
  const [flowRoutes, setFlowRoutes] = useState<FlowRoute[]>([])
  const [flowAssignments, setFlowAssignments] = useState<FlowAssignment[]>([])

  useEffect(() => {
    if (settingsData) {
      setFlowRoles(settingsData.flowPayload?.data?.roles || [])
      setFlowRoutes(settingsData.flowPayload?.data?.routes || [])
      setFlowAssignments(settingsData.flowPayload?.data?.assignments || [])
    }
  }, [settingsData])

  const [previewUserId, setPreviewUserId] = useState("")
  const [previewRelieverId, setPreviewRelieverId] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewResult, setPreviewResult] = useState<any>(null)

  const [policyForm, setPolicyForm] = useState<PolicyFormState>({
    leave_type_id: "",
    annual_days: 0,
    eligibility: "all",
    min_tenure_months: 0,
    notice_days: 0,
    accrual_mode: "calendar_days",
    carry_forward_cap: 0,
  })

  const [holidayForm, setHolidayForm] = useState<HolidayFormState>({
    holiday_date: "",
    location: "global",
    name: "",
    is_business_day: false,
  })

  function loadData() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leavePolicies() })
  }

  async function savePolicy() {
    try {
      const response = await fetch("/api/hr/leave/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save policy")
      toast.success("Policy saved")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy")
    }
  }

  async function saveHoliday() {
    try {
      const response = await fetch("/api/hr/leave/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holidayForm),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save holiday")
      toast.success("Holiday saved")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save holiday")
    }
  }

  async function saveSla(stage: string, due_hours: number, reminder_hours_before: number) {
    try {
      const response = await fetch("/api/hr/leave/sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, due_hours, reminder_hours_before }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save SLA")
      toast.success("SLA saved")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save SLA")
    }
  }

  async function saveFlowBuilder() {
    try {
      const response = await fetch("/api/hr/leave/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: flowRoles, routes: flowRoutes, assignments: flowAssignments }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save flow")
      toast.success("Leave approval flow saved")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save flow")
    }
  }

  async function runPreview() {
    try {
      if (!previewUserId || !previewRelieverId) {
        toast.error("Enter requester and reliever user IDs")
        return
      }
      const response = await fetch(
        `/api/hr/leave/flow/preview?user_id=${encodeURIComponent(previewUserId)}&reliever_id=${encodeURIComponent(previewRelieverId)}`
      )
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to preview flow")
      setPreviewResult(payload.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview flow")
    }
  }

  if (isLoading) return <PageLoader />
  if (isError) return <QueryError message="Could not load leave settings." onRetry={refetch} />

  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageHeader
        title="Leave Settings"
        description="Manage policies, holidays, SLA windows, data quality, and approval flows"
        backLink={{ href: "/admin/hr", label: "Back to HR Dashboard" }}
      />

      <ApprovalFlowBuilderCard
        flowHealth={flowHealth}
        canEditFlow={canEditFlow}
        flowRoles={flowRoles}
        onFlowRolesChange={setFlowRoles}
        flowRoutes={flowRoutes}
        onFlowRoutesChange={setFlowRoutes}
        flowAssignments={flowAssignments}
        onFlowAssignmentsChange={setFlowAssignments}
        onSave={saveFlowBuilder}
        previewUserId={previewUserId}
        onPreviewUserIdChange={setPreviewUserId}
        previewRelieverId={previewRelieverId}
        onPreviewRelieverIdChange={setPreviewRelieverId}
        previewResult={previewResult}
        onRunPreview={runPreview}
      />

      <LeavePolicyCard
        leaveTypes={leaveTypes}
        policies={policies}
        form={policyForm}
        onFormChange={setPolicyForm}
        onSave={savePolicy}
      />

      <HolidayCalendarCard holidays={holidays} form={holidayForm} onFormChange={setHolidayForm} onSave={saveHoliday} />

      <ApprovalSlaCard slas={slas} onSave={saveSla} />

      <DataQualityCard dataQuality={dataQuality} />
    </div>
  )
}
