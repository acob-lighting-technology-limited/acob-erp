"use client"

import { useEffect, useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle,
  XCircle,
  Loader2,
  PlayCircle,
  FlaskConical,
  SkipForward,
  ScanSearch,
  ShieldAlert,
  ClipboardList,
  Ticket,
  Route,
  Package,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { PageHeader, PageWrapper } from "@/components/layout"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"

const log = logger("dev-tests")

// ── Shared Types ──────────────────────────────────────────────────────────────
type StepResult = {
  step: string
  status: "ok" | "error" | "skipped"
  detail?: string
  data?: unknown
}

type TestResult = {
  ok: boolean
  steps: StepResult[]
  error?: string
}

type DiagRow = {
  requester_kind: string
  stage_order: number
  approver_role_code: string
  resolved: boolean
  resolved_user_id?: string | null
  resolved_name?: string | null
  fail_reason?: string
}

type DiagnosticsResult = {
  results: DiagRow[]
  broken_count: number
  total: number
}

type HelpDeskDiagRow = {
  flow_kind: "support" | "procurement"
  stage_code: "department_lead" | "head_corporate_services" | "managing_director"
  scope: string
  resolved: boolean
  resolved_user_id?: string | null
  resolved_name?: string | null
  fail_reason?: string
}

type HelpDeskDiagnosticsResult = {
  results: HelpDeskDiagRow[]
  broken_count: number
  total: number
}

type TaskDiagRow = {
  check_code: "department_lead_coverage" | "department_assignment_target"
  scope: string
  resolved: boolean
  resolved_user_id?: string | null
  resolved_name?: string | null
  fail_reason?: string
}

type TaskDiagnosticsResult = {
  results: TaskDiagRow[]
  broken_count: number
  total: number
}

type AssetMailRoutingRow = {
  employee_id: string
  employee_name: string
  department: string
  routing_class: "employee" | "department_lead" | "hcs" | "md"
  recipients: string[]
}

type AssetMailRoutingResult = {
  rows: AssetMailRoutingRow[]
  total: number
  hcs: { id: string; name: string } | null
  md: { id: string; name: string } | null
  mail_types: string[]
}

// ── Shared Step Renderer ──────────────────────────────────────────────────────
function StepList({ steps }: { steps: StepResult[] }) {
  if (!steps.length) return null
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
            step.status === "ok" && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
            step.status === "error" && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
            step.status === "skipped" && "bg-muted/40 border-dashed"
          )}
        >
          <div className="mt-0.5 shrink-0">
            {step.status === "ok" && <CheckCircle className="h-4 w-4 text-green-600" />}
            {step.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
            {step.status === "skipped" && <SkipForward className="text-muted-foreground h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="text-xs font-medium">{step.step}</code>
              <Badge
                variant={step.status === "ok" ? "default" : step.status === "error" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {step.status}
              </Badge>
            </div>
            {step.detail && <p className="text-muted-foreground mt-0.5 text-xs">{step.detail}</p>}
            {step.data !== undefined && (
              <pre className="bg-muted mt-1 max-h-36 overflow-auto rounded p-2 text-xs">
                {JSON.stringify(step.data as Record<string, unknown>, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ResultCard({ result }: { result: TestResult }) {
  const pass = result.steps.filter((s) => s.status === "ok").length
  const fail = result.steps.filter((s) => s.status === "error").length
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {result.ok ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          {result.ok ? "All Stages Passed" : "Flow Failed"}
          <span className="text-muted-foreground ml-auto flex gap-3 text-sm font-normal">
            <span className="text-green-600">{pass} passed</span>
            <span className="text-red-500">{fail} failed</span>
          </span>
        </CardTitle>
        {result.error && <p className="text-destructive text-sm">{result.error}</p>}
      </CardHeader>
      <CardContent>
        <StepList steps={result.steps} />
      </CardContent>
    </Card>
  )
}

// ── FIX_HINTS for route diagnostics ──────────────────────────────────────────
const FIX_HINTS: Record<string, string> = {
  md: 'Set someone\'s profile: is_department_lead = true AND department = "Executive Management" (or add it to lead_departments)',
  hcs: 'Set someone\'s profile: is_department_lead = true AND department = "Corporate Services" (or add it to lead_departments)',
  admin_hr_lead:
    'Set someone\'s profile: is_department_lead = true AND department = "Admin & HR" (or add it to lead_departments)',
  department_lead: "Dynamic — the requester's department needs someone with is_department_lead = true",
  reliever: "Dynamic per request — no fix needed",
}

const HELP_DESK_FIX_HINTS: Record<string, string> = {
  department_lead: "Assign at least one active department lead for this department.",
  requester_department_lead: "Assign an active lead for the requester's department.",
  service_department_lead: "Assign an active lead for the selected service department.",
  head_corporate_services: "Set an active Corporate Services lead/admin candidate for the HCS stage.",
  managing_director: "Set an active MD candidate (Executive Management admin or super_admin/developer).",
}

const TASK_FIX_HINTS: Record<string, string> = {
  department_lead_coverage: "Assign an active department lead for this department.",
  department_assignment_target: "Ensure at least one active user belongs to this department.",
}

// ── Route Diagnostics Panel ───────────────────────────────────────────────────
function RouteDiagnosticsPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticsResult | null>(null)

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/dev/leave-route-diagnostics")
      const data: DiagnosticsResult = await res.json()
      setResult(data)
      if (data.broken_count === 0) {
        toast.success("All routes fully configured ✓")
      } else {
        toast.error(`${data.broken_count} broken stage(s) found`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const byKind = result
    ? (result.results || []).reduce<Record<string, DiagRow[]>>((acc, r) => {
        acc[r.requester_kind] = acc[r.requester_kind] || []
        acc[r.requester_kind].push(r)
        return acc
      }, {})
    : {}

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanSearch className="h-4 w-4" />
          Leave Route Diagnostics
        </CardTitle>
        <CardDescription>
          Validates every approval stage in the DB. Run this to spot missing approver assignments before running the
          flow test.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {loading ? "Checking…" : "Check All Routes"}
          </Button>
          {result && (
            <span className={cn("text-sm font-medium", result.broken_count === 0 ? "text-green-600" : "text-red-500")}>
              {result.broken_count === 0
                ? `✓ All ${result.total} stage(s) OK`
                : `✗ ${result.broken_count} / ${result.total} broken`}
            </span>
          )}
        </div>

        {result && Object.keys(byKind).length > 0 && (
          <div className="space-y-4">
            {Object.entries(byKind).map(([kind, rows]) => {
              const broken = rows.filter((r) => !r.resolved)
              return (
                <div key={kind}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{kind.replace(/_/g, " ")}</span>
                    <Badge variant={broken.length > 0 ? "destructive" : "default"} className="text-xs">
                      {broken.length > 0 ? `${broken.length} broken` : "OK"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {rows.map((row, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-md border px-3 py-2 text-xs",
                          row.resolved
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {row.resolved ? (
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-medium">
                              Stage {row.stage_order}: {row.approver_role_code}
                            </span>
                            {row.resolved ? (
                              <span className="text-muted-foreground ml-2">
                                → {row.resolved_name || row.resolved_user_id}
                              </span>
                            ) : (
                              <div className="mt-1 space-y-1">
                                <p className="text-red-600 dark:text-red-400">{row.fail_reason}</p>
                                {FIX_HINTS[row.approver_role_code] && (
                                  <p className="text-amber-700 dark:text-amber-400">
                                    <strong>Fix:</strong> {FIX_HINTS[row.approver_role_code]}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HelpDeskRouteDiagnosticsPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HelpDeskDiagnosticsResult | null>(null)

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/dev/help-desk-route-diagnostics")
      const data: HelpDeskDiagnosticsResult = await res.json()
      setResult(data)
      if (data.broken_count === 0) {
        toast.success("Help Desk routes fully configured ✓")
      } else {
        toast.error(`${data.broken_count} Help Desk route issue(s) found`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const byFlow = result
    ? (result.results || []).reduce<Record<string, HelpDeskDiagRow[]>>((acc, row) => {
        acc[row.flow_kind] = acc[row.flow_kind] || []
        acc[row.flow_kind].push(row)
        return acc
      }, {})
    : {}

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanSearch className="h-4 w-4" />
          Help Desk Route Diagnostics
        </CardTitle>
        <CardDescription>
          Checks support/procurement route readiness, including department lead coverage and procurement approvers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {loading ? "Checking…" : "Check All Routes"}
          </Button>
          {result && (
            <span className={cn("text-sm font-medium", result.broken_count === 0 ? "text-green-600" : "text-red-500")}>
              {result.broken_count === 0
                ? `✓ All ${result.total} check(s) OK`
                : `✗ ${result.broken_count} / ${result.total} broken`}
            </span>
          )}
        </div>

        {result && Object.keys(byFlow).length > 0 && (
          <div className="space-y-4">
            {Object.entries(byFlow).map(([flowKind, rows]) => {
              const broken = rows.filter((r) => !r.resolved)
              return (
                <div key={flowKind}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{flowKind} flow</span>
                    <Badge variant={broken.length > 0 ? "destructive" : "default"} className="text-xs">
                      {broken.length > 0 ? `${broken.length} broken` : "OK"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {rows.map((row, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-md border px-3 py-2 text-xs",
                          row.resolved
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {row.resolved ? (
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-medium">
                              {row.stage_code} ({row.scope})
                            </span>
                            {row.resolved ? (
                              <span className="text-muted-foreground ml-2">
                                → {row.resolved_name || row.resolved_user_id}
                              </span>
                            ) : (
                              <div className="mt-1 space-y-1">
                                <p className="text-red-600 dark:text-red-400">{row.fail_reason}</p>
                                {HELP_DESK_FIX_HINTS[row.stage_code] && (
                                  <p className="text-amber-700 dark:text-amber-400">
                                    <strong>Fix:</strong> {HELP_DESK_FIX_HINTS[row.stage_code]}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TaskRouteDiagnosticsPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TaskDiagnosticsResult | null>(null)

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/dev/task-route-diagnostics")
      const data: TaskDiagnosticsResult = await res.json()
      setResult(data)
      if (data.broken_count === 0) {
        toast.success("Task route checks passed ✓")
      } else {
        toast.error(`${data.broken_count} Task routing issue(s) found`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanSearch className="h-4 w-4" />
          Task Route Diagnostics
        </CardTitle>
        <CardDescription>
          Checks department lead coverage and department assignment targets for task visibility and notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {loading ? "Checking…" : "Check All Routes"}
          </Button>
          {result && (
            <span className={cn("text-sm font-medium", result.broken_count === 0 ? "text-green-600" : "text-red-500")}>
              {result.broken_count === 0
                ? `✓ All ${result.total} check(s) OK`
                : `✗ ${result.broken_count} / ${result.total} broken`}
            </span>
          )}
        </div>

        {result && result.results.length > 0 && (
          <div className="space-y-1">
            {result.results.map((row, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  row.resolved
                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                    : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                )}
              >
                <div className="flex items-start gap-2">
                  {row.resolved ? (
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-mono font-medium">
                      {row.check_code} ({row.scope})
                    </span>
                    {row.resolved ? (
                      row.resolved_name || row.resolved_user_id ? (
                        <span className="text-muted-foreground ml-2">
                          → {row.resolved_name || row.resolved_user_id}
                        </span>
                      ) : null
                    ) : (
                      <div className="mt-1 space-y-1">
                        <p className="text-red-600 dark:text-red-400">{row.fail_reason}</p>
                        {TASK_FIX_HINTS[row.check_code] && (
                          <p className="text-amber-700 dark:text-amber-400">
                            <strong>Fix:</strong> {TASK_FIX_HINTS[row.check_code]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AssetMailRoutingPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AssetMailRoutingResult | null>(null)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/dev/asset-mail-routing")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load asset mail routing")
      setResult(data as AssetMailRoutingResult)
      toast.success("Asset mail routing loaded")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Asset Mail Routing
        </CardTitle>
        <CardDescription>
          Shows the live employee-to-recipient mapping used for the five asset mail types.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {loading ? "Loading…" : "Load Live Matrix"}
          </Button>
          {result && (
            <span className="text-sm font-medium text-green-600">
              {result.total} active employees | HCS: {result.hcs?.name || "Not found"} | MD:{" "}
              {result.md?.name || "Not found"}
            </span>
          )}
        </div>

        {result && (
          <div className="space-y-3">
            <div className="text-muted-foreground text-xs">
              Asset mails covered: Asset Officially Assigned, Asset Transfer Initiated, Asset Transfer Received, Asset
              Officially Returned, Asset Status Alert
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="border px-3 py-2 text-left">Employee</th>
                    <th className="border px-3 py-2 text-left">Department</th>
                    <th className="border px-3 py-2 text-left">Routing Class</th>
                    <th className="border px-3 py-2 text-left">Recipients For All 5 Asset Mails</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.employee_id} className="odd:bg-background even:bg-muted/20">
                      <td className="border px-3 py-2">{row.employee_name}</td>
                      <td className="border px-3 py-2">{row.department}</td>
                      <td className="border px-3 py-2">{row.routing_class}</td>
                      <td className="border px-3 py-2">{row.recipients.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Leave Tab ─────────────────────────────────────────────────────────────────
function LeaveTab({
  employees,
  leaveTypes,
}: {
  employees: { value: string; label: string }[]
  leaveTypes: { value: string; label: string }[]
}) {
  const [requesterId, setRequesterId] = useState("")
  const [relieverId, setRelieverId] = useState("")
  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [cleanup, setCleanup] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const run = async () => {
    if (!requesterId || !relieverId || !leaveTypeId) {
      toast.error("Fill in all fields")
      return
    }
    if (requesterId === relieverId) {
      toast.error("Requester and reliever must be different")
      return
    }
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch("/api/dev/leave-flow-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_id: requesterId,
          reliever_id: relieverId,
          leave_type_id: leaveTypeId,
          cleanup,
        }),
      })
      const payload: TestResult = await res.json()
      setResult(payload)
      if (payload.ok) {
        toast.success("All stages passed ✓")
      } else {
        toast.error("One or more stages failed")
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <RouteDiagnosticsPanel />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            Leave Flow Test
          </CardTitle>
          <CardDescription>
            Simulates the full leave request → reliever → dept lead → HR approval chain. A test request is created 7
            days from now for 3 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Requester</Label>
              <SearchableSelect
                value={requesterId}
                onValueChange={setRequesterId}
                options={employees}
                placeholder="Select requester"
                searchPlaceholder="Search…"
              />
            </div>
            <div className="space-y-2">
              <Label>Reliever</Label>
              <SearchableSelect
                value={relieverId}
                onValueChange={setRelieverId}
                options={employees.filter((e) => e.value !== requesterId)}
                placeholder="Select reliever"
                searchPlaceholder="Search…"
              />
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch checked={cleanup} onCheckedChange={setCleanup} id="leave-cleanup" />
              <Label htmlFor="leave-cleanup" className="cursor-pointer">
                Delete test request after run
              </Label>
            </div>
          </div>
          <Button onClick={run} disabled={running || !requesterId || !relieverId || !leaveTypeId} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running…" : "Run Leave Test"}
          </Button>
        </CardContent>
      </Card>

      {result && <ResultCard result={result} />}
    </div>
  )
}

// ── Help Desk Tab ─────────────────────────────────────────────────────────────
function HelpDeskTab({
  employees,
  departments,
}: {
  employees: { value: string; label: string }[]
  departments: string[]
}) {
  const [requesterId, setRequesterId] = useState("")
  const [dept, setDept] = useState("")
  const [requestType, setRequestType] = useState<"support" | "procurement">("support")
  const [supportMode, setSupportMode] = useState<"open_queue" | "lead_review_required">("open_queue")
  const [cleanup, setCleanup] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const run = async () => {
    if (!requesterId || !dept) {
      toast.error("Fill in all fields")
      return
    }
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch("/api/dev/flow-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "help_desk",
          requester_id: requesterId,
          service_department: dept,
          request_type: requestType,
          support_mode: supportMode,
          cleanup,
        }),
      })
      const payload: TestResult = await res.json()
      setResult(payload)
      if (payload.ok) {
        toast.success("All stages passed ✓")
      } else {
        toast.error("One or more stages failed")
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <HelpDeskRouteDiagnosticsPanel />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" />
            Help Desk Flow Test
          </CardTitle>
          <CardDescription>
            Tests either the support lifecycle or the procurement approval chain, depending on the selected request
            type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Requester (ticket submitter)</Label>
              <SearchableSelect
                value={requesterId}
                onValueChange={setRequesterId}
                options={employees}
                placeholder="Select requester"
                searchPlaceholder="Search…"
              />
            </div>
            <div className="space-y-2">
              <Label>Service Department</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select value={requestType} onValueChange={(value: "support" | "procurement") => setRequestType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="procurement">Procurement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {requestType === "support" && (
              <div className="space-y-2">
                <Label>Support Mode</Label>
                <Select
                  value={supportMode}
                  onValueChange={(value: "open_queue" | "lead_review_required") => setSupportMode(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select support mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open_queue">Open Queue</SelectItem>
                    <SelectItem value="lead_review_required">Lead Review Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end gap-3 pb-1">
              <Switch checked={cleanup} onCheckedChange={setCleanup} id="hd-cleanup" />
              <Label htmlFor="hd-cleanup" className="cursor-pointer">
                Delete test ticket after run
              </Label>
            </div>
          </div>
          <Button onClick={run} disabled={running || !requesterId || !dept} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running…" : "Run Help Desk Test"}
          </Button>
        </CardContent>
      </Card>
      {result && <ResultCard result={result} />}
    </div>
  )
}

// ── Task Tab ──────────────────────────────────────────────────────────────────
function TaskTab({ employees }: { employees: { value: string; label: string }[] }) {
  const [assignerId, setAssignerId] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [cleanup, setCleanup] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const run = async () => {
    if (!assignerId || !assigneeId) {
      toast.error("Fill in all fields")
      return
    }
    if (assignerId === assigneeId) {
      toast.error("Assigner and assignee must be different")
      return
    }
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch("/api/dev/flow-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "task", assigner_id: assignerId, assignee_id: assigneeId, cleanup }),
      })
      const payload: TestResult = await res.json()
      setResult(payload)
      if (payload.ok) {
        toast.success("All stages passed ✓")
      } else {
        toast.error("One or more stages failed")
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <TaskRouteDiagnosticsPanel />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Task Flow Test
          </CardTitle>
          <CardDescription>
            Creates an individual task, moves it from pending → in_progress → completed, then verifies the final status.
            Tests the core task lifecycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Assigner (admin creating the task)</Label>
              <SearchableSelect
                value={assignerId}
                onValueChange={setAssignerId}
                options={employees}
                placeholder="Select assigner"
                searchPlaceholder="Search…"
              />
            </div>
            <div className="space-y-2">
              <Label>Assignee (employee receiving the task)</Label>
              <SearchableSelect
                value={assigneeId}
                onValueChange={setAssigneeId}
                options={employees.filter((e) => e.value !== assignerId)}
                placeholder="Select assignee"
                searchPlaceholder="Search…"
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch checked={cleanup} onCheckedChange={setCleanup} id="task-cleanup" />
              <Label htmlFor="task-cleanup" className="cursor-pointer">
                Delete test task after run
              </Label>
            </div>
          </div>
          <Button onClick={run} disabled={running || !assignerId || !assigneeId} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running…" : "Run Task Test"}
          </Button>
        </CardContent>
      </Card>
      {result && <ResultCard result={result} />}
    </div>
  )
}

function AssetTab() {
  return (
    <div className="space-y-4">
      <AssetMailRoutingPanel />
    </div>
  )
}

// ── Root Content Component ────────────────────────────────────────────────────
export function DevTestsContent() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([])
  const [leaveTypes, setLeaveTypes] = useState<{ value: string; label: string }[]>([])
  const [departments, setDepartments] = useState<string[]>([])

  const load = useCallback(async () => {
    const [profilesRes, typesRes, deptRes] = await Promise.all([
      applyAssignableStatusFilter(
        supabase.from("profiles").select("id, full_name, first_name, last_name, company_email").order("first_name"),
        { allowLegacyNullStatus: false }
      ),
      supabase.from("leave_types").select("id, name").order("name"),
      supabase.from("departments").select("name").order("name"),
    ])

    setEmployees(
      (profilesRes.data || []).map((p: any) => ({
        value: p.id,
        label: p.full_name?.trim() || `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.company_email || p.id,
      }))
    )
    setLeaveTypes((typesRes.data || []).map((t: any) => ({ value: t.id, label: t.name })))
    setDepartments((deptRes.data || []).map((d: any) => d.name).filter(Boolean))
  }, [])

  useEffect(() => {
    load().catch((err) => log.error({ err: String(err) }, "load failed"))
  }, [load])

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Developer Tests"
        description="End-to-end flow tests for leave, help desk, task management, and asset routing"
        icon={FlaskConical}
        backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      />

      <Tabs defaultValue="leave" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leave" className="gap-2">
            <Route className="h-4 w-4" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="helpdesk" className="gap-2">
            <Ticket className="h-4 w-4" />
            Help Desk
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <Package className="h-4 w-4" />
            Assets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave">
          <LeaveTab employees={employees} leaveTypes={leaveTypes} />
        </TabsContent>

        <TabsContent value="helpdesk">
          <HelpDeskTab employees={employees} departments={departments} />
        </TabsContent>

        <TabsContent value="tasks">
          <TaskTab employees={employees} />
        </TabsContent>

        <TabsContent value="assets">
          <AssetTab />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  )
}
