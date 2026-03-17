"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2 } from "lucide-react"

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PreviewResult {
  requester_kind: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  route_snapshot?: any[]
}

interface ApprovalFlowBuilderCardProps {
  flowHealth: FlowHealth | null
  canEditFlow: boolean
  flowRoles: FlowRole[]
  onFlowRolesChange: (roles: FlowRole[]) => void
  flowRoutes: FlowRoute[]
  onFlowRoutesChange: (routes: FlowRoute[]) => void
  flowAssignments: FlowAssignment[]
  onFlowAssignmentsChange: (assignments: FlowAssignment[]) => void
  onSave: () => void
  previewUserId: string
  onPreviewUserIdChange: (value: string) => void
  previewRelieverId: string
  onPreviewRelieverIdChange: (value: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  previewResult: PreviewResult | null
  onRunPreview: () => void
}

export function ApprovalFlowBuilderCard({
  flowHealth,
  canEditFlow,
  flowRoles,
  onFlowRolesChange,
  flowRoutes,
  onFlowRoutesChange,
  flowAssignments,
  onFlowAssignmentsChange,
  onSave,
  previewUserId,
  onPreviewUserIdChange,
  previewRelieverId,
  onPreviewRelieverIdChange,
  previewResult,
  onRunPreview,
}: ApprovalFlowBuilderCardProps) {
  const addRoleRow = () =>
    onFlowRolesChange([
      ...flowRoles,
      { code: "", name: "", description: "", resolution_mode: "rule_based", is_active: true },
    ])

  const addRouteRow = () =>
    onFlowRoutesChange([
      ...flowRoutes,
      { requester_kind: "employee", stage_order: 1, approver_role_code: "reliever", is_active: true },
    ])

  const addAssignmentRow = () =>
    onFlowAssignmentsChange([
      ...flowAssignments,
      { approver_role_code: "", user_id: "", scope_type: "global", scope_value: "", is_primary: true, is_active: true },
    ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Flow Builder</CardTitle>
        <CardDescription>Editable routing engine for leave approvals (super admin/developer controls)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border p-3 text-sm">
          <p className="font-medium">Routing Health</p>
          {flowHealth ? (
            <div className="mt-2 space-y-1">
              <p>Configured: {flowHealth.is_configured ? "Yes" : "No"}</p>
              <p>Admin &amp; HR lead count: {flowHealth.admin_hr_lead_count}</p>
              <p>MD lead count: {flowHealth.md_count}</p>
              <p>HCS lead count: {flowHealth.hcs_count}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Health unavailable</p>
          )}
        </div>

        {/* Approver Roles */}
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
                  onFlowRolesChange(flowRoles.map((item, i) => (i === idx ? { ...item, code: e.target.value } : item)))
                }
              />
              <Input
                value={role.name}
                disabled={!canEditFlow}
                placeholder="name"
                onChange={(e) =>
                  onFlowRolesChange(flowRoles.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)))
                }
              />
              <Input
                value={role.description || ""}
                disabled={!canEditFlow}
                placeholder="description"
                onChange={(e) =>
                  onFlowRolesChange(
                    flowRoles.map((item, i) => (i === idx ? { ...item, description: e.target.value } : item))
                  )
                }
              />
              <Select
                value={role.resolution_mode}
                disabled={!canEditFlow}
                onValueChange={(value) =>
                  onFlowRolesChange(
                    flowRoles.map((item, i) =>
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
                    onFlowRolesChange(
                      flowRoles.map((item, i) => (i === idx ? { ...item, is_active: value === "true" } : item))
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
                    onClick={() => onFlowRolesChange(flowRoles.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Route Matrix */}
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
                  onFlowRoutesChange(
                    flowRoutes.map((item, i) =>
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
                  onFlowRoutesChange(
                    flowRoutes.map((item, i) =>
                      i === idx ? { ...item, stage_order: Number(e.target.value || 1) } : item
                    )
                  )
                }
              />
              <Input
                value={route.approver_role_code}
                disabled={!canEditFlow}
                placeholder="approver role code"
                onChange={(e) =>
                  onFlowRoutesChange(
                    flowRoutes.map((item, i) => (i === idx ? { ...item, approver_role_code: e.target.value } : item))
                  )
                }
              />
              <Select
                value={route.is_active ? "true" : "false"}
                disabled={!canEditFlow}
                onValueChange={(value) =>
                  onFlowRoutesChange(
                    flowRoutes.map((item, i) => (i === idx ? { ...item, is_active: value === "true" } : item))
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
                    onClick={() => onFlowRoutesChange(flowRoutes.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Fixed Assignments */}
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
                  onFlowAssignmentsChange(
                    flowAssignments.map((item, i) =>
                      i === idx ? { ...item, approver_role_code: e.target.value } : item
                    )
                  )
                }
              />
              <Input
                value={assignment.user_id}
                disabled={!canEditFlow}
                placeholder="user id"
                onChange={(e) =>
                  onFlowAssignmentsChange(
                    flowAssignments.map((item, i) => (i === idx ? { ...item, user_id: e.target.value } : item))
                  )
                }
              />
              <Select
                value={assignment.scope_type}
                disabled={!canEditFlow}
                onValueChange={(value) =>
                  onFlowAssignmentsChange(
                    flowAssignments.map((item, i) =>
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
                  onFlowAssignmentsChange(
                    flowAssignments.map((item, i) => (i === idx ? { ...item, scope_value: e.target.value } : item))
                  )
                }
              />
              <Select
                value={assignment.is_active ? "true" : "false"}
                disabled={!canEditFlow}
                onValueChange={(value) =>
                  onFlowAssignmentsChange(
                    flowAssignments.map((item, i) => (i === idx ? { ...item, is_active: value === "true" } : item))
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
                    onClick={() => onFlowAssignmentsChange(flowAssignments.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={onSave} disabled={!canEditFlow}>
            Save Flow Configuration
          </Button>
          {!canEditFlow && <p className="text-muted-foreground text-sm">View only. Super admin/developer can edit.</p>}
        </div>

        {/* Route Preview */}
        <div className="space-y-2 rounded border p-3">
          <p className="font-medium">Route Preview</p>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Requester user_id"
              value={previewUserId}
              onChange={(e) => onPreviewUserIdChange(e.target.value)}
            />
            <Input
              placeholder="Reliever user_id"
              value={previewRelieverId}
              onChange={(e) => onPreviewRelieverIdChange(e.target.value)}
            />
            <Button onClick={onRunPreview}>Preview</Button>
          </div>
          {previewResult && (
            <div className="text-sm">
              <p>Requester kind: {previewResult.requester_kind}</p>
              <div className="mt-1 space-y-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
  )
}
