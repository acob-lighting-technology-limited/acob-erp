"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatCard } from "@/components/ui/stat-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
}

type PlanAction = {
  title: string
  description?: string | null
  due_date?: string | null
}

type DevelopmentPlan = {
  id: string
  user_id: string
  title: string
  description: string | null
  focus_area: string
  priority: "low" | "medium" | "high"
  status: "active" | "completed" | "cancelled" | "on_hold"
  target_date: string | null
  progress_pct: number | null
  created_at: string
  user?: Profile | null
  actions?: Array<{ id: string; title: string; status: string; completed_at: string | null }> | null
  review?: { id: string } | null
}

type Cycle = { id: string; name: string }

const FOCUS_LABELS: Record<string, string> = {
  general: "General",
  communication: "Communication",
  leadership: "Leadership",
  technical: "Technical Skills",
  collaboration: "Collaboration",
  time_management: "Time Management",
  problem_solving: "Problem Solving",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  completed: "secondary",
  cancelled: "destructive",
  on_hold: "outline",
}

const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
}

function formatName(profile: Profile | null | undefined) {
  return `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown"
}

export default function AdminDevelopmentPlansPage() {
  const [plans, setPlans] = useState<DevelopmentPlan[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  // Form
  const [selectedEmployee, setSelectedEmployee] = useState("")
  const [selectedCycle, setSelectedCycle] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [focusArea, setFocusArea] = useState("general")
  const [priority, setPriority] = useState("medium")
  const [targetDate, setTargetDate] = useState("")
  const [actionLines, setActionLines] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [plansRes, profilesRes, cyclesRes] = await Promise.all([
        // Admin fetches all plans by getting a list of all employees first,
        // then fetching by dept. For simplicity use the all-employees API.
        fetch("/api/hr/performance/development-plans?user_id=all_admin"),
        fetch("/api/hr/profiles?all=true"),
        fetch("/api/hr/performance/cycles"),
      ])
      const [plansData, profilesData, cyclesData] = await Promise.all([
        plansRes.json().catch(() => ({})),
        profilesRes.json().catch(() => ({})),
        cyclesRes.json().catch(() => ({})),
      ])
      setPlans(plansData?.data || [])
      setEmployees(profilesData?.data || [])
      setCycles(cyclesData?.data || [])
    } catch {
      toast.error("Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const departments = useMemo(
    () => Array.from(new Set(plans.map((p) => p.user?.department).filter(Boolean) as string[])).sort(),
    [plans]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return plans.filter((p) => {
      const name = formatName(p.user).toLowerCase()
      const dept = String(p.user?.department || "").toLowerCase()
      const statusMatch = statusFilter === "all" || p.status === statusFilter
      const deptMatch = departmentFilter === "all" || p.user?.department === departmentFilter
      const searchMatch = !q || name.includes(q) || dept.includes(q) || p.title.toLowerCase().includes(q)
      return statusMatch && deptMatch && searchMatch
    })
  }, [plans, searchQuery, statusFilter, departmentFilter])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedEmployee || !title) {
      toast.error("Employee and title are required")
      return
    }
    setIsSubmitting(true)
    try {
      const actions = actionLines
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ title: line }))

      const res = await fetch("/api/hr/performance/development-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedEmployee,
          review_cycle_id: selectedCycle || null,
          title,
          description: description || null,
          focus_area: focusArea,
          priority,
          target_date: targetDate || null,
          actions: actions.length > 0 ? actions : undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Failed to create")
      toast.success(data.message || "Development plan created")
      setIsCreateOpen(false)
      setSelectedEmployee("")
      setSelectedCycle("")
      setTitle("")
      setDescription("")
      setFocusArea("general")
      setPriority("medium")
      setTargetDate("")
      setActionLines("")
      void loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create plan")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Development Plans"
        description="Create and track employee development plans linked to performance reviews."
        icon={BookOpen}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <Button onClick={() => setIsCreateOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Plan
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Total Plans" value={filtered.length} icon={BookOpen} description="All development plans" />
        <StatCard
          title="Active"
          value={filtered.filter((p) => p.status === "active").length}
          icon={BookOpen}
          description="In progress"
        />
        <StatCard
          title="Completed"
          value={filtered.filter((p) => p.status === "completed").length}
          icon={BookOpen}
          description="Finished"
        />
        <StatCard
          title="Avg Progress"
          value={
            filtered.length > 0
              ? `${Math.round(filtered.reduce((sum, p) => sum + (p.progress_pct || 0), 0) / filtered.length)}%`
              : "-"
          }
          icon={BookOpen}
          description="Across active plans"
        />
      </div>

      <Card className="mb-4">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search employee, department, or plan title…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Development Plans</CardTitle>
          <CardDescription>Click &quot;Edit&quot; on a plan to update status or add notes.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No development plans found. Create one using the &quot;New Plan&quot; button.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-12">S/N</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((plan, index) => (
                    <TableRow key={plan.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{formatName(plan.user)}</TableCell>
                      <TableCell>{plan.user?.department || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{plan.title}</TableCell>
                      <TableCell>{FOCUS_LABELS[plan.focus_area] || plan.focus_area}</TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANTS[plan.priority] || "secondary"} className="capitalize">
                          {plan.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={plan.progress_pct || 0} className="h-2 w-16" />
                          <span className="text-muted-foreground text-xs">{plan.progress_pct || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[plan.status] || "outline"} className="capitalize">
                          {plan.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {plan.target_date
                          ? new Date(plan.target_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Development Plan</DialogTitle>
            <DialogDescription>
              Create a development plan for an employee, optionally linked to a review cycle.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Employee *</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee…" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {formatName(e)} {e.department ? `(${e.department})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Plan Title *</Label>
                <Input
                  placeholder="e.g. Improve Leadership Communication"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Focus Area</Label>
                <Select value={focusArea} onValueChange={setFocusArea}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FOCUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label>Review Cycle (optional)</Label>
                <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What should this plan achieve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Action Steps (one per line)</Label>
              <Textarea
                placeholder={
                  "Complete leadership course\nSchedule weekly 1:1 with manager\nPresent project update to team"
                }
                value={actionLines}
                onChange={(e) => setActionLines(e.target.value)}
                rows={4}
              />
              <p className="text-muted-foreground text-xs">
                Each line becomes one action step the employee can tick off.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
