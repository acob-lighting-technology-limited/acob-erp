"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { PageLoader, QueryError } from "@/components/ui/query-states"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState, FormFieldGroup } from "@/components/ui/patterns"

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

  // Read-only derived data from query
  const leaveTypes: LeaveType[] = settingsData?.typesPayload?.data || []
  const policies: LeavePolicy[] = settingsData?.policyPayload?.data || []
  const holidays: any[] = settingsData?.holidayPayload?.data || []
  const slas: any[] = settingsData?.slaPayload?.data || []
  const dataQuality: any[] = settingsData?.qualityPayload?.data || []
  const flowHealth: FlowHealth | null = settingsData?.flowPayload?.data?.health || null
  const canEditFlow: boolean = Boolean(settingsData?.flowPayload?.permissions?.can_edit)

  // Local editable state for flow configuration
  const [flowRoles, setFlowRoles] = useState<FlowRole[]>([])
  const [flowRoutes, setFlowRoutes] = useState<FlowRoute[]>([])
  const [flowAssignments, setFlowAssignments] = useState<FlowAssignment[]>([])

  // Sync local state when data loads
  useEffect(() => {
    if (settingsData) {
      setFlowRoles(settingsData.flowPayload?.data?.roles || [])
      setFlowRoutes(settingsData.flowPayload?.data?.routes || [])
      setFlowAssignments(settingsData.flowPayload?.data?.assignments || [])
    }
  }, [settingsData])

  const [previewUserId, setPreviewUserId] = useState("")
  const [previewRelieverId, setPreviewRelieverId] = useState("")
  const [previewResult, setPreviewResult] = useState<any>(null)

  const [policyForm, setPolicyForm] = useState({
    leave_type_id: "",
    annual_days: 0,
    eligibility: "all",
    min_tenure_months: 0,
    notice_days: 0,
    accrual_mode: "calendar_days",
    carry_forward_cap: 0,
  })

  const [holidayForm, setHolidayForm] = useState({
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
        body: JSON.stringify({
          roles: flowRoles,
          routes: flowRoutes,
          assignments: flowAssignments,
        }),
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

  function addRouteRow() {
    setFlowRoutes((prev) => [
      ...prev,
      {
        requester_kind: "employee",
        stage_order: 1,
        approver_role_code: "reliever",
        is_active: true,
      },
    ])
  }

  function addRoleRow() {
    setFlowRoles((prev) => [
      ...prev,
      {
        code: "",
        name: "",
        description: "",
        resolution_mode: "rule_based",
        is_active: true,
      },
    ])
  }

  function addAssignmentRow() {
    setFlowAssignments((prev) => [
      ...prev,
      {
        approver_role_code: "",
        user_id: "",
        scope_type: "global",
        scope_value: "",
        is_primary: true,
        is_active: true,
      },
    ])
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

      <Card>
        <CardHeader>
          <CardTitle>Approval Flow Builder</CardTitle>
          <CardDescription>
            Editable routing engine for leave approvals (super admin/developer controls)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded border p-3 text-sm">
            <p className="font-medium">Routing Health</p>
            {flowHealth ? (
              <div className="mt-2 space-y-1">
                <p>Configured: {flowHealth.is_configured ? "Yes" : "No"}</p>
                <p>Admin & HR lead count: {flowHealth.admin_hr_lead_count}</p>
                <p>MD lead count: {flowHealth.md_count}</p>
                <p>HCS lead count: {flowHealth.hcs_count}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">Health unavailable</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Approver Roles</h3>
              {canEditFlow && (
                <Button size="sm" variant="outline" onClick={addRoleRow}>
                  <Plus className="mr-1 h-3 w-3" /> Add Role
                </Button>
              )}
            </div>
            {flowRoles.map((role, idx) => (
              <div key={`${role.code || "new"}-${idx}`} className="grid gap-2 rounded border p-3 md:grid-cols-5">
                <Input
                  value={role.code}
                  disabled={!canEditFlow}
                  placeholder="code"
                  onChange={(e) =>
                    setFlowRoles((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, code: e.target.value } : item))
                    )
                  }
                />
                <Input
                  value={role.name}
                  disabled={!canEditFlow}
                  placeholder="name"
                  onChange={(e) =>
                    setFlowRoles((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                    )
                  }
                />
                <Input
                  value={role.description || ""}
                  disabled={!canEditFlow}
                  placeholder="description"
                  onChange={(e) =>
                    setFlowRoles((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, description: e.target.value } : item))
                    )
                  }
                />
                <Select
                  value={role.resolution_mode}
                  disabled={!canEditFlow}
                  onValueChange={(value) =>
                    setFlowRoles((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, resolution_mode: value as FlowRole["resolution_mode"] } : item
                      )
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rule_based">rule_based</SelectItem>
                    <SelectItem value="department_lead">department_lead</SelectItem>
                    <SelectItem value="fixed_user">fixed_user</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Select
                    value={role.is_active ? "true" : "false"}
                    disabled={!canEditFlow}
                    onValueChange={(value) =>
                      setFlowRoles((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, is_active: value === "true" } : item))
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">active</SelectItem>
                      <SelectItem value="false">inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  {canEditFlow && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFlowRoles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Route Matrix</h3>
              {canEditFlow && (
                <Button size="sm" variant="outline" onClick={addRouteRow}>
                  <Plus className="mr-1 h-3 w-3" /> Add Stage
                </Button>
              )}
            </div>
            {flowRoutes.map((route, idx) => (
              <div
                key={`${route.requester_kind}-${route.stage_order}-${idx}`}
                className="grid gap-2 rounded border p-3 md:grid-cols-5"
              >
                <Select
                  value={route.requester_kind}
                  disabled={!canEditFlow}
                  onValueChange={(value) =>
                    setFlowRoutes((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, requester_kind: value as FlowRoute["requester_kind"] } : item
                      )
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">employee</SelectItem>
                    <SelectItem value="dept_lead">dept_lead</SelectItem>
                    <SelectItem value="admin_hr_lead">admin_hr_lead</SelectItem>
                    <SelectItem value="hcs">hcs</SelectItem>
                    <SelectItem value="md">md</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={route.stage_order}
                  disabled={!canEditFlow}
                  onChange={(e) =>
                    setFlowRoutes((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, stage_order: Number(e.target.value || 1) } : item))
                    )
                  }
                />
                <Input
                  value={route.approver_role_code}
                  disabled={!canEditFlow}
                  placeholder="approver role code"
                  onChange={(e) =>
                    setFlowRoutes((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, approver_role_code: e.target.value } : item))
                    )
                  }
                />
                <Select
                  value={route.is_active ? "true" : "false"}
                  disabled={!canEditFlow}
                  onValueChange={(value) =>
                    setFlowRoutes((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, is_active: value === "true" } : item))
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">active</SelectItem>
                    <SelectItem value="false">inactive</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  {canEditFlow && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFlowRoutes((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Fixed Assignments (optional)</h3>
              {canEditFlow && (
                <Button size="sm" variant="outline" onClick={addAssignmentRow}>
                  <Plus className="mr-1 h-3 w-3" /> Add Assignment
                </Button>
              )}
            </div>
            {flowAssignments.map((assignment, idx) => (
              <div
                key={`${assignment.approver_role_code}-${assignment.user_id}-${idx}`}
                className="grid gap-2 rounded border p-3 md:grid-cols-6"
              >
                <Input
                  value={assignment.approver_role_code}
                  disabled={!canEditFlow}
                  placeholder="role code"
                  onChange={(e) =>
                    setFlowAssignments((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, approver_role_code: e.target.value } : item))
                    )
                  }
                />
                <Input
                  value={assignment.user_id}
                  disabled={!canEditFlow}
                  placeholder="user id"
                  onChange={(e) =>
                    setFlowAssignments((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, user_id: e.target.value } : item))
                    )
                  }
                />
                <Select
                  value={assignment.scope_type}
                  disabled={!canEditFlow}
                  onValueChange={(value) =>
                    setFlowAssignments((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, scope_type: value as FlowAssignment["scope_type"] } : item
                      )
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">global</SelectItem>
                    <SelectItem value="department">department</SelectItem>
                    <SelectItem value="office">office</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={assignment.scope_value || ""}
                  disabled={!canEditFlow}
                  placeholder="scope value"
                  onChange={(e) =>
                    setFlowAssignments((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, scope_value: e.target.value } : item))
                    )
                  }
                />
                <Select
                  value={assignment.is_active ? "true" : "false"}
                  disabled={!canEditFlow}
                  onValueChange={(value) =>
                    setFlowAssignments((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, is_active: value === "true" } : item))
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">active</SelectItem>
                    <SelectItem value="false">inactive</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  {canEditFlow && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFlowAssignments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={saveFlowBuilder} disabled={!canEditFlow}>
              Save Flow Configuration
            </Button>
            {!canEditFlow && (
              <p className="text-muted-foreground text-sm">View only. Super admin/developer can edit.</p>
            )}
          </div>

          <div className="space-y-2 rounded border p-3">
            <p className="font-medium">Route Preview</p>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder="Requester user_id"
                value={previewUserId}
                onChange={(e) => setPreviewUserId(e.target.value)}
              />
              <Input
                placeholder="Reliever user_id"
                value={previewRelieverId}
                onChange={(e) => setPreviewRelieverId(e.target.value)}
              />
              <Button onClick={runPreview}>Preview</Button>
            </div>
            {previewResult && (
              <div className="text-sm">
                <p>Requester kind: {previewResult.requester_kind}</p>
                <div className="mt-1 space-y-1">
                  {(previewResult.route_snapshot || []).map((stage: any) => (
                    <p key={`${stage.stage_order}-${stage.approver_role_code}`}>
                      {stage.stage_order}. {stage.approver_role_code} ({stage.approver_user_id})
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave Policy Rules</CardTitle>
          <CardDescription>Configure annual allocation and eligibility per leave type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FormFieldGroup label="Leave Type">
              <Select
                value={policyForm.leave_type_id}
                onValueChange={(value) => setPolicyForm((prev) => ({ ...prev, leave_type_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldGroup>
            <div className="space-y-2">
              <Label>Annual Days</Label>
              <Input
                type="number"
                value={policyForm.annual_days}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, annual_days: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Min Tenure (months)</Label>
              <Input
                type="number"
                value={policyForm.min_tenure_months}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, min_tenure_months: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notice Days</Label>
              <Input
                type="number"
                value={policyForm.notice_days}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, notice_days: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Eligibility</Label>
              <Select
                value={policyForm.eligibility}
                onValueChange={(value) => setPolicyForm((prev) => ({ ...prev, eligibility: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="female_only">Female Only</SelectItem>
                  <SelectItem value="male_only">Male Only</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Accrual Mode</Label>
              <Select
                value={policyForm.accrual_mode}
                onValueChange={(value) => setPolicyForm((prev) => ({ ...prev, accrual_mode: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar_days">Calendar Days</SelectItem>
                  <SelectItem value="business_days">Business Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Carry Forward Cap</Label>
              <Input
                type="number"
                value={policyForm.carry_forward_cap}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, carry_forward_cap: Number(e.target.value || 0) }))}
              />
            </div>
          </div>

          <Button onClick={savePolicy}>Save Policy</Button>

          <div className="space-y-2">
            {policies.map((policy) => (
              <div key={policy.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{policy.leave_type?.name || policy.leave_type_id}</p>
                <p>
                  {policy.annual_days} days | {policy.eligibility} | {policy.accrual_mode} | notice {policy.notice_days}{" "}
                  day(s)
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holiday Calendar</CardTitle>
          <CardDescription>Used for business-day leave calculations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={holidayForm.holiday_date}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, holiday_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={holidayForm.location}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={holidayForm.name}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={saveHoliday}>Add Holiday</Button>

          <div className="space-y-2">
            {holidays.map((holiday) => (
              <div key={holiday.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{holiday.name}</p>
                <p>
                  {holiday.holiday_date} ({holiday.location})
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval SLA</CardTitle>
          <CardDescription>Configure due and reminder timing per stage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slas.map((sla) => (
            <div key={sla.id} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
              <span className="w-40 font-medium">{sla.stage}</span>
              <Input
                className="w-32"
                type="number"
                defaultValue={sla.due_hours}
                onBlur={(e) =>
                  saveSla(sla.stage, Number(e.target.value || sla.due_hours), Number(sla.reminder_hours_before))
                }
              />
              <span>due hours</span>
              <Input
                className="w-32"
                type="number"
                defaultValue={sla.reminder_hours_before}
                onBlur={(e) =>
                  saveSla(sla.stage, Number(sla.due_hours), Number(e.target.value || sla.reminder_hours_before))
                }
              />
              <span>reminder hours before</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Data Quality</CardTitle>
          <CardDescription>Employees missing required leave-policy profile fields</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {dataQuality.length === 0 && (
            <EmptyState
              title="No data-quality gaps found"
              description="All required leave-policy profile fields are populated."
              className="p-4"
            />
          )}
          {dataQuality.map((entry: any) => (
            <div key={entry.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{entry.full_name || entry.company_email || entry.id}</p>
              <p>
                Missing:{" "}
                {[
                  !entry.gender && "gender",
                  !entry.employment_date && "employment_date",
                  !entry.employment_type && "employment_type",
                  !entry.work_location && "work_location",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
