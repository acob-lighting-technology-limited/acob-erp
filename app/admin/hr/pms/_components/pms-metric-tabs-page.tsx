"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Clock3, Download, Loader2, Plus, Search, ShieldCheck, Target } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { exportPmsRowsToExcel, exportPmsRowsToPdf } from "@/lib/pms/export"

type MetricKey = "kpi" | "goals" | "attendance" | "behaviour"
type TabKey = "individual" | "department" | "cycle"
type IconKey = "kpi" | "goals" | "attendance" | "behaviour"

type MetricSnapshotPayload = {
  metric: MetricKey
  selected_cycle_id: string | null
  users: { id: string; name: string; department: string }[]
  departments: string[]
  cycles: { id: string; name: string; review_type: string | null }[]
  rows: {
    individual: Record<string, unknown>[]
    department: Record<string, unknown>[]
    cycle: Record<string, unknown>[]
  }
}

function asString(value: unknown) {
  if (value === null || value === undefined) return "-"
  return String(value)
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clampMetricValue(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return ""
  return String(Math.min(100, Math.max(1, parsed)))
}

function MetricAddDialog({
  metric,
  open,
  onOpenChange,
  users,
  cycles,
  onSaved,
  initialUserId,
  initialCycleId,
}: {
  metric: MetricKey
  open: boolean
  onOpenChange: (open: boolean) => void
  users: { id: string; name: string; department: string }[]
  cycles: { id: string; name: string; review_type: string | null }[]
  onSaved: () => void
  initialUserId?: string
  initialCycleId?: string
}) {
  const [userId, setUserId] = useState("")
  const [cycleId, setCycleId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [goalId, setGoalId] = useState("")
  const [department, setDepartment] = useState("")
  const [scoreValue, setScoreValue] = useState("")
  const [strengths, setStrengths] = useState("")
  const [areasForImprovement, setAreasForImprovement] = useState("")
  const [managerComments, setManagerComments] = useState("")
  const [competencies, setCompetencies] = useState({
    collaboration: "",
    accountability: "",
    communication: "",
    teamwork: "",
    loyalty: "",
    professional_conduct: "",
  })

  useEffect(() => {
    if (!open) return
    setUserId(initialUserId || "")
    setCycleId(initialCycleId || cycles[0]?.id || "")
    setScoreValue("")
    setStrengths("")
    setAreasForImprovement("")
    setManagerComments("")
    setCompetencies({
      collaboration: "",
      accountability: "",
      communication: "",
      teamwork: "",
      loyalty: "",
      professional_conduct: "",
    })
  }, [open, users, cycles, initialUserId, initialCycleId])

  useEffect(() => {
    if (!open || !userId || !cycleId) return
    let active = true
    setLoading(true)

    void (async () => {
      try {
        const selectedUser = users.find((user) => user.id === userId)
        setDepartment(selectedUser?.department || "")

        if (metric === "kpi") {
          const response = await fetch(
            `/api/hr/performance/reviews?user_id=${encodeURIComponent(userId)}&cycle_id=${encodeURIComponent(cycleId)}`,
            { cache: "no-store" }
          )
          const payload = (await response.json().catch(() => null)) as {
            data?: Array<{ kpi_score?: number | null }>
          } | null
          const item = payload?.data?.[0]
          if (!active) return
          setScoreValue(item?.kpi_score !== null && item?.kpi_score !== undefined ? String(item.kpi_score) : "")
        }

        if (metric === "goals") {
          const response = await fetch(
            `/api/hr/performance/goals?department=${encodeURIComponent(selectedUser?.department || "")}&cycle_id=${encodeURIComponent(cycleId)}`,
            { cache: "no-store" }
          )
          const payload = (await response.json().catch(() => null)) as { data?: Record<string, unknown>[] } | null
          const item = payload?.data?.[0]
          if (!active) return
          setGoalId(asString(item?.id) === "-" ? "" : asString(item?.id))
        }

        if (metric === "attendance") {
          const response = await fetch(
            `/api/hr/performance/reviews?user_id=${encodeURIComponent(userId)}&cycle_id=${encodeURIComponent(cycleId)}`,
            { cache: "no-store" }
          )
          const payload = (await response.json().catch(() => null)) as {
            data?: Array<{ attendance_score?: number | null }>
          } | null
          const item = payload?.data?.[0]
          if (!active) return
          setScoreValue(
            item?.attendance_score !== null && item?.attendance_score !== undefined ? String(item.attendance_score) : ""
          )
        }

        if (metric === "behaviour") {
          const response = await fetch(
            `/api/hr/performance/score?user_id=${encodeURIComponent(userId)}&cycle_id=${encodeURIComponent(cycleId)}`,
            { cache: "no-store" }
          )
          const payload = (await response.json().catch(() => null)) as {
            data?: {
              existing_review?: {
                behaviour_competencies?: Record<string, unknown> | null
                strengths?: string | null
                areas_for_improvement?: string | null
                manager_comments?: string | null
              } | null
            }
          } | null
          const entry = payload?.data?.existing_review?.behaviour_competencies || {}
          if (!active) return
          setCompetencies({
            collaboration:
              entry.collaboration !== undefined && entry.collaboration !== null ? asString(entry.collaboration) : "",
            accountability:
              entry.accountability !== undefined && entry.accountability !== null ? asString(entry.accountability) : "",
            communication:
              entry.communication !== undefined && entry.communication !== null ? asString(entry.communication) : "",
            teamwork: entry.teamwork !== undefined && entry.teamwork !== null ? asString(entry.teamwork) : "",
            loyalty: entry.loyalty !== undefined && entry.loyalty !== null ? asString(entry.loyalty) : "",
            professional_conduct:
              entry.professional_conduct !== undefined && entry.professional_conduct !== null
                ? asString(entry.professional_conduct)
                : "",
          })
          setStrengths(String(payload?.data?.existing_review?.strengths || ""))
          setAreasForImprovement(String(payload?.data?.existing_review?.areas_for_improvement || ""))
          setManagerComments(String(payload?.data?.existing_review?.manager_comments || ""))
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [open, metric, userId, cycleId, users])

  async function handleSave() {
    setSaving(true)
    try {
      if (!userId) {
        throw new Error("Select an employee first")
      }
      if (!cycleId) {
        throw new Error("Select a cycle first")
      }

      if (metric === "kpi") {
        const numericScore = Number(scoreValue)
        if (!Number.isFinite(numericScore) || numericScore <= 0 || numericScore > 100) {
          throw new Error("KPI score must be between 1 and 100")
        }

        const response = await fetch("/api/hr/performance/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            review_cycle_id: cycleId,
            kpi_score: numericScore,
          }),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to save")
      } else if (metric === "goals") {
        const response = await fetch("/api/hr/performance/goals", {
          method: goalId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            goalId
              ? {
                  id: goalId,
                  achieved_value: scoreValue ? Number(scoreValue) : null,
                }
              : {
                  department,
                  review_cycle_id: cycleId,
                  title: "Department Goal",
                }
          ),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to save")
      } else if (metric === "attendance") {
        const numericScore = Number(scoreValue)
        if (!Number.isFinite(numericScore) || numericScore <= 0 || numericScore > 100) {
          throw new Error("Attendance score must be between 1 and 100")
        }
        const response = await fetch("/api/hr/attendance/admin-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, review_cycle_id: cycleId, attendance_score: numericScore }),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to save")
      } else {
        const response = await fetch("/api/hr/performance/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            review_cycle_id: cycleId,
            behaviour_competencies: Object.fromEntries(
              Object.entries(competencies).map(([key, value]) => [key, Number(clampMetricValue(value) || 0)])
            ),
            strengths,
            areas_for_improvement: areasForImprovement,
            manager_comments: managerComments,
          }),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to save")
      }

      toast.success("Saved successfully")
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Add{" "}
            {metric === "kpi"
              ? "KPI Score"
              : metric === "attendance"
                ? "Attendance Score"
                : metric.charAt(0).toUpperCase() + metric.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Select employee and cycle first. Existing data auto-loads when available.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cycle</Label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading existing data...
          </div>
        ) : null}

        {metric === "kpi" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={department} disabled />
            </div>
            <div className="space-y-2">
              <Label>KPI Score</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={scoreValue}
                onChange={(event) => setScoreValue(clampMetricValue(event.target.value))}
              />
            </div>
          </div>
        ) : null}

        {metric === "attendance" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={department} disabled />
            </div>
            <div className="space-y-2">
              <Label>Attendance Score</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={scoreValue}
                onChange={(event) => setScoreValue(clampMetricValue(event.target.value))}
              />
            </div>
          </div>
        ) : null}

        {metric === "behaviour" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(competencies).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label>{key.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={value}
                    onChange={(event) =>
                      setCompetencies((prev) => ({ ...prev, [key]: clampMetricValue(event.target.value) }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Strengths</Label>
                <Textarea value={strengths} onChange={(event) => setStrengths(event.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Areas for Improvement</Label>
                <Textarea
                  value={areasForImprovement}
                  onChange={(event) => setAreasForImprovement(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Manager Comments</Label>
              <Textarea value={managerComments} onChange={(event) => setManagerComments(event.target.value)} rows={4} />
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PmsMetricTabsPage({
  metric,
  title,
  description,
  iconKey,
}: {
  metric: MetricKey
  title: string
  description: string
  iconKey: IconKey
}) {
  const [tab, setTab] = useState<TabKey>("individual")
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<MetricSnapshotPayload | null>(null)
  const [cycleId, setCycleId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null)
  const hasLoadedSnapshotRef = useRef(false)

  useEffect(() => {
    let active = true
    if (hasLoadedSnapshotRef.current) {
      setIsRefreshing(true)
    } else {
      setIsInitialLoading(true)
    }
    void (async () => {
      try {
        const query = cycleId ? `&cycle_id=${encodeURIComponent(cycleId)}` : ""
        const response = await fetch(`/api/hr/performance/metric-snapshot?metric=${metric}${query}`, {
          cache: "no-store",
        })
        const payload = (await response.json().catch(() => null)) as {
          data?: MetricSnapshotPayload
          error?: string
        } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to fetch data")
        if (!active || !payload?.data) return
        setData(payload.data)
        hasLoadedSnapshotRef.current = true
        if (!cycleId && payload.data.selected_cycle_id) setCycleId(payload.data.selected_cycle_id)
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to fetch data")
      } finally {
        if (active) {
          setIsInitialLoading(false)
          setIsRefreshing(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [metric, cycleId, refreshKey])

  const rawRows = useMemo(() => data?.rows[tab] || [], [data, tab])
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return rawRows.filter((row) => {
      const values = Object.values(row).map((value) => asString(value).toLowerCase())
      const matchesQuery = query.length === 0 || values.some((value) => value.includes(query))
      const matchesDepartment =
        tab === "individual" || tab === "department"
          ? departmentFilter === "all" || asString((row as Record<string, unknown>).department) === departmentFilter
          : true
      const matchesUser =
        tab === "department"
          ? true
          : userFilter === "all"
            ? true
            : tab === "individual"
              ? asString((row as Record<string, unknown>).user_id) === userFilter
              : true
      return matchesQuery && matchesDepartment && matchesUser
    })
  }, [rawRows, searchQuery, tab, departmentFilter, userFilter])

  const columns = useMemo(() => {
    if (metric === "goals") {
      if (tab === "individual")
        return ["employee", "department", "cycle", "total_goals", "approved_goals", "completed_goals"]
      if (tab === "department") return ["department", "cycle", "total_goals", "approved_goals", "completed_goals"]
      return ["cycle", "review_type", "total_goals", "approved_goals", "completed_goals"]
    }
    if (tab === "individual") return ["employee", "department", "cycle", "metric_value"]
    if (tab === "department") return ["department", "cycle", "employee_count", "submitted_count", "metric_value"]
    return ["cycle", "review_type", "employee_count", "submitted_count", "departments_counted", "metric_value"]
  }, [metric, tab])

  const exportRows = filteredRows.map((row, index) =>
    Object.fromEntries([
      ["S/N", index + 1],
      ...columns.map((column) => [
        column.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        asString((row as Record<string, unknown>)[column]),
      ]),
    ])
  )

  const Icon =
    iconKey === "kpi" ? Target : iconKey === "goals" ? CheckCircle2 : iconKey === "attendance" ? Clock3 : ShieldCheck

  const metricValues = filteredRows
    .map((row) => {
      const value = (row as Record<string, unknown>).metric_value
      return typeof value === "number" && Number.isFinite(value) ? value : null
    })
    .filter((value): value is number => value !== null)

  const valueAverage =
    metricValues.length > 0
      ? Math.round((metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length) * 100) / 100
      : null

  const submittedTotal = filteredRows.reduce(
    (sum, row) => sum + asNumber((row as Record<string, unknown>).submitted_count),
    0
  )

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={title}
        description={description}
        icon={Icon}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsExportOpen(true)}
              disabled={filteredRows.length === 0}
              className="h-8 gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="h-8 gap-2" size="sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" />
              {metric === "kpi" ? "Add KPI Score" : metric === "attendance" ? "Add Attendance Score" : "Add Behaviour"}
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="mt-4 mb-4">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="department">Department</TabsTrigger>
          <TabsTrigger value="cycle">Cycle</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Rows</p>
            <p className="text-2xl font-semibold">{filteredRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">{tab === "individual" ? "Average Value" : "Submitted"}</p>
            <p className="text-2xl font-semibold">{tab === "individual" ? (valueAverage ?? "-") : submittedTotal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">{tab === "individual" ? "Cycle" : "Average Value"}</p>
            <p className="text-lg font-semibold">
              {tab === "individual"
                ? data?.cycles.find((cycle) => cycle.id === cycleId)?.name || "Current"
                : (valueAverage ?? "-")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4 border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search current view..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            {tab === "individual" ? (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {(data?.users || []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {tab === "individual" || tab === "department" ? (
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {(data?.departments || []).map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="w-full md:w-72">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                {(data?.cycles || []).map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{tab[0].toUpperCase() + tab.slice(1)} View</CardTitle>
            {isRefreshing ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </div>
            ) : null}
          </div>
          <CardDescription>
            {tab === "individual"
              ? "Filter by individual, department and cycle."
              : tab === "department"
                ? "Department glance by cycle."
                : "Cycle summary view."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInitialLoading && filteredRows.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading records...
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1050px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    {columns.map((column) => (
                      <TableHead key={column}>
                        {column.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                      </TableHead>
                    ))}
                    {tab === "individual" && metric !== "goals" ? (
                      <TableHead className="text-right">Edit</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => (
                    <TableRow key={`${tab}-${index}`}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      {columns.map((column) => (
                        <TableCell key={column}>{asString((row as Record<string, unknown>)[column])}</TableCell>
                      ))}
                      {tab === "individual" && metric !== "goals" ? (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRow(row as Record<string, unknown>)
                              setIsModalOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MetricAddDialog
        metric={metric}
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) setEditingRow(null)
        }}
        users={data?.users || []}
        cycles={data?.cycles || []}
        onSaved={() => setRefreshKey((value) => value + 1)}
        initialUserId={asString(editingRow?.user_id) === "-" ? "" : asString(editingRow?.user_id)}
        initialCycleId={cycleId}
      />

      <ExportOptionsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        title={`Export ${title}`}
        options={[
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
        ]}
        onSelect={(id) => {
          const filename = `pms-${metric}-${tab}-${new Date().toISOString().slice(0, 10)}`
          if (id === "excel") {
            void exportPmsRowsToExcel(exportRows, filename)
            return
          }
          void exportPmsRowsToPdf(exportRows, filename, title)
        }}
      />
    </PageWrapper>
  )
}
