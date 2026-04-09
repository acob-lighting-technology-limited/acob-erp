"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, Download, Loader2, Plus, Search, ShieldCheck, Target } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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

function exportRows(filenamePrefix: string, headers: string[], rows: string[][]) {
  if (rows.length === 0) return
  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function MetricAddDialog({
  metric,
  open,
  onOpenChange,
  users,
  cycles,
  onSaved,
}: {
  metric: MetricKey
  open: boolean
  onOpenChange: (open: boolean) => void
  users: { id: string; name: string; department: string }[]
  cycles: { id: string; name: string; review_type: string | null }[]
  onSaved: () => void
}) {
  const [userId, setUserId] = useState("")
  const [cycleId, setCycleId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [goalId, setGoalId] = useState("")
  const [goalTitle, setGoalTitle] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [achievedValue, setAchievedValue] = useState("")
  const [priority, setPriority] = useState("medium")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState("present")
  const [competencies, setCompetencies] = useState({
    collaboration: "0",
    accountability: "0",
    communication: "0",
    teamwork: "0",
    loyalty: "0",
    professional_conduct: "0",
  })

  useEffect(() => {
    if (!open) return
    setUserId((value) => value || users[0]?.id || "")
    setCycleId((value) => value || cycles[0]?.id || "")
  }, [open, users, cycles])

  useEffect(() => {
    if (!open || !userId || !cycleId) return
    let active = true
    setLoading(true)
    void (async () => {
      try {
        if (metric === "goals" || metric === "kpi") {
          const response = await fetch(
            `/api/hr/performance/goals?user_id=${encodeURIComponent(userId)}&cycle_id=${encodeURIComponent(cycleId)}`
          )
          const payload = (await response.json().catch(() => null)) as { data?: Record<string, unknown>[] } | null
          const item = payload?.data?.[0]
          if (!active) return
          setGoalId(asString(item?.id) === "-" ? "" : asString(item?.id))
          setGoalTitle(asString(item?.title) === "-" ? "" : asString(item?.title))
          setTargetValue(asString(item?.target_value) === "-" ? "" : asString(item?.target_value))
          setAchievedValue(asString(item?.achieved_value) === "-" ? "" : asString(item?.achieved_value))
          setPriority(asString(item?.priority) === "-" ? "medium" : asString(item?.priority))
        }
        if (metric === "behaviour") {
          const response = await fetch(
            `/api/hr/performance/score?user_id=${encodeURIComponent(userId)}&cycle_id=${encodeURIComponent(cycleId)}`
          )
          const payload = (await response.json().catch(() => null)) as {
            data?: { existing_review?: { behaviour_competencies?: Record<string, unknown> | null } }
          } | null
          const entry = payload?.data?.existing_review?.behaviour_competencies || {}
          if (!active) return
          setCompetencies({
            collaboration: asString(entry.collaboration ?? "0"),
            accountability: asString(entry.accountability ?? "0"),
            communication: asString(entry.communication ?? "0"),
            teamwork: asString(entry.teamwork ?? "0"),
            loyalty: asString(entry.loyalty ?? "0"),
            professional_conduct: asString(entry.professional_conduct ?? "0"),
          })
        }
      } catch {
        if (!active) return
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [open, metric, userId, cycleId])

  async function handleSave() {
    setSaving(true)
    try {
      if (metric === "goals" || metric === "kpi") {
        const response = await fetch("/api/hr/performance/goals", {
          method: goalId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            goalId
              ? {
                  id: goalId,
                  title: goalTitle,
                  target_value: targetValue ? Number(targetValue) : null,
                  achieved_value: achievedValue ? Number(achievedValue) : null,
                  priority,
                }
              : {
                  user_id: userId,
                  review_cycle_id: cycleId,
                  title: goalTitle,
                  target_value: targetValue ? Number(targetValue) : null,
                  achieved_value: achievedValue ? Number(achievedValue) : null,
                  priority,
                }
          ),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to save")
      } else if (metric === "attendance") {
        const response = await fetch("/api/hr/attendance/admin-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, date, status }),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to save")
      } else {
        const response = await fetch("/api/hr/performance/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, review_cycle_id: cycleId, behaviour_competencies: competencies }),
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
          <DialogTitle>Add {metric === "kpi" ? "KPI" : metric.charAt(0).toUpperCase() + metric.slice(1)}</DialogTitle>
          <DialogDescription>Select user/cycle first. Existing data auto-loads when available.</DialogDescription>
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
          {metric !== "attendance" ? (
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
          ) : (
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
          )}
        </div>
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading existing data...
          </div>
        ) : null}
        {(metric === "goals" || metric === "kpi") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{metric === "kpi" ? "KPI Title" : "Goal Title"}</Label>
              <Input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Target Value</Label>
              <Input type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Achieved Value</Label>
              <Input type="number" value={achievedValue} onChange={(event) => setAchievedValue(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {metric === "attendance" && (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="wfh">WFH</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {metric === "behaviour" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(competencies).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <Label>{key.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(event) => setCompetencies((prev) => ({ ...prev, [key]: event.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
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
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<MetricSnapshotPayload | null>(null)
  const [cycleId, setCycleId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      try {
        const query = cycleId ? `&cycle_id=${encodeURIComponent(cycleId)}` : ""
        const response = await fetch(`/api/hr/performance/metric-snapshot?metric=${metric}&view=${tab}${query}`, {
          cache: "no-store",
        })
        const payload = (await response.json().catch(() => null)) as {
          data?: MetricSnapshotPayload
          error?: string
        } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to fetch data")
        if (!active || !payload?.data) return
        setData(payload.data)
        if (!cycleId && payload.data.selected_cycle_id) setCycleId(payload.data.selected_cycle_id)
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to fetch data")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [metric, tab, cycleId, refreshKey])

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
        tab !== "individual"
          ? true
          : userFilter === "all" || asString((row as Record<string, unknown>).user_id) === userFilter
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
    if (tab === "department") return ["department", "cycle", "employee_count", "metric_value"]
    return ["cycle", "review_type", "metric_value", "departments_counted"]
  }, [metric, tab])

  function handleExport() {
    const headers = [
      "S/N",
      ...columns.map((column) => column.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())),
    ]
    const rows = filteredRows.map((row, index) => [
      String(index + 1),
      ...columns.map((column) => asString((row as Record<string, unknown>)[column])),
    ])
    exportRows(`pms-${metric}-${tab}`, headers, rows)
  }

  const Icon =
    iconKey === "kpi" ? Target : iconKey === "goals" ? CheckCircle2 : iconKey === "attendance" ? Clock3 : ShieldCheck
  const valueAverage =
    filteredRows.length > 0
      ? Math.round(
          (filteredRows.reduce((sum, row) => sum + asNumber((row as Record<string, unknown>).metric_value), 0) /
            filteredRows.length) *
            100
        ) / 100
      : 0

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
              onClick={handleExport}
              disabled={filteredRows.length === 0}
              className="h-8 gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="h-8 gap-2" size="sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" />
              {metric === "kpi"
                ? "Add KPI"
                : metric === "goals"
                  ? "Add Goal"
                  : metric === "attendance"
                    ? "Add Attendance"
                    : "Add Behaviour"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Rows</p>
            <p className="text-2xl font-semibold">{filteredRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Average Value</p>
            <p className="text-2xl font-semibold">{valueAverage}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Cycle</p>
            <p className="text-lg font-semibold">
              {data?.cycles.find((cycle) => cycle.id === cycleId)?.name || "Current"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="mt-4 mb-4">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="department">Department</TabsTrigger>
          <TabsTrigger value="cycle">Cycle</TabsTrigger>
        </TabsList>
      </Tabs>

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
          <CardTitle>{tab[0].toUpperCase() + tab.slice(1)} View</CardTitle>
          <CardDescription>
            {tab === "individual"
              ? "Filter by individual, department and cycle."
              : tab === "department"
                ? "Department glance by cycle."
                : "Cycle summary view."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading records...
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No records found.</p>
          ) : (
            <Table className="min-w-[1050px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  {columns.map((column) => (
                    <TableHead key={column}>
                      {column.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, index) => (
                  <TableRow key={`${tab}-${index}`}>
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    {columns.map((column) => (
                      <TableCell key={column}>{asString((row as Record<string, unknown>)[column])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MetricAddDialog
        metric={metric}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        users={data?.users || []}
        cycles={data?.cycles || []}
        onSaved={() => setRefreshKey((value) => value + 1)}
      />
    </PageWrapper>
  )
}
