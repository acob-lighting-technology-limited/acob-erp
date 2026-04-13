"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Plus, Search, Target } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Goal } from "@/app/(app)/goals/page"

type ReviewCycle = {
  id: string
  name: string
  review_type: string | null
}

type GoalWithCycle = Goal & {
  cycle?: ReviewCycle | null
}

type TabKey = "department" | "cycle"

const INITIAL_FORM = {
  department: "",
  review_cycle_id: "",
  title: "",
  description: "",
  due_date: "",
}

export function AdminGoalsContent({
  initialGoals,
  managedDepartments,
  cycles,
  canCreateGoal,
}: {
  initialGoals: GoalWithCycle[]
  managedDepartments: string[]
  cycles: ReviewCycle[]
  canCreateGoal: boolean
}) {
  const [goals, setGoals] = useState(initialGoals)
  const [tab, setTab] = useState<TabKey>("department")
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [cycleFilter, setCycleFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    department: managedDepartments[0] || "",
    review_cycle_id: cycles[0]?.id || "",
  })

  const filteredGoalRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return goals.filter((goal) => {
      const matchesQuery =
        query.length === 0 ||
        [goal.title, goal.description, goal.department, goal.cycle?.name, goal.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesDepartment = departmentFilter === "all" || (goal.department || "-") === departmentFilter
      const matchesCycle = cycleFilter === "all" || (goal.review_cycle_id || "") === cycleFilter
      return matchesQuery && matchesDepartment && matchesCycle
    })
  }, [cycleFilter, departmentFilter, goals, searchQuery])

  const cycleRows = useMemo(() => {
    return cycles
      .map((cycle) => {
        const cycleGoals = goals.filter((goal) => goal.review_cycle_id === cycle.id)
        return {
          id: cycle.id,
          cycle: cycle.name,
          review_type: cycle.review_type || "-",
          departments: new Set(cycleGoals.map((goal) => goal.department).filter(Boolean)).size,
          goals: cycleGoals.length,
          approved: cycleGoals.filter((goal) => goal.approval_status === "approved").length,
        }
      })
      .filter((row) => {
        const query = searchQuery.trim().toLowerCase()
        const matchesQuery =
          query.length === 0 ||
          [row.cycle, row.review_type].some((value) => String(value).toLowerCase().includes(query))
        const matchesCycle = cycleFilter === "all" || row.id === cycleFilter
        return matchesQuery && matchesCycle
      })
  }, [cycleFilter, cycles, goals, searchQuery])

  async function handleCreateGoal() {
    if (!form.department || !form.review_cycle_id || !form.title.trim()) {
      toast.error("Department, cycle, and goal title are required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/hr/performance/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = (await response.json().catch(() => null)) as { data?: GoalWithCycle; error?: string } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "Failed to create goal")
      setGoals((current) => [payload.data as GoalWithCycle, ...current])
      setForm({ ...INITIAL_FORM, department: form.department, review_cycle_id: form.review_cycle_id })
      setIsDialogOpen(false)
      toast.success("Department goal created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create goal")
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS Goals"
        description="Department leads create department goals here, then create tasks under the specific goal."
        icon={Target}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          canCreateGoal ? (
            <Button size="sm" className="h-8 gap-2" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="mb-4">
        <TabsList>
          <TabsTrigger value="department">Department</TabsTrigger>
          <TabsTrigger value="cycle">Cycle</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="mb-4 border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search goal, department, or cycle..."
                className="pl-10"
              />
            </div>
            {tab === "department" ? (
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {managedDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
              <SelectTrigger className="w-full md:w-72">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                {cycles.map((cycle) => (
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
          <CardTitle>{tab === "department" ? "Department Goals" : "Cycle View"}</CardTitle>
          <CardDescription>
            {tab === "department"
              ? "Open the right goal row and create a task under it for one person or your department queue."
              : "Review goal coverage by cycle before opening the cycle details."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tab === "department" ? (
            filteredGoalRows.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">No department goals found.</p>
            ) : (
              <Table className="min-w-[1100px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Goal</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGoalRows.map((goal, index) => (
                    <TableRow key={goal.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{goal.title}</p>
                          {goal.description ? (
                            <p className="text-muted-foreground text-xs">{goal.description}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{goal.department || "-"}</TableCell>
                      <TableCell>{goal.cycle?.name || "-"}</TableCell>
                      <TableCell className="capitalize">{String(goal.status || "").replaceAll("_", " ")}</TableCell>
                      <TableCell className="capitalize">{goal.approval_status || "pending"}</TableCell>
                      <TableCell>{goal.due_date ? new Date(goal.due_date).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/hr/pms/goals/task?goal_id=${encodeURIComponent(goal.id)}`}>
                          <Button size="sm" variant="outline">
                            Create Task
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : cycleRows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No cycle records found.</p>
          ) : (
            <Table className="min-w-[980px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Review Type</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead>Goals</TableHead>
                  <TableHead>Approved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycleRows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{row.cycle}</TableCell>
                    <TableCell>{row.review_type}</TableCell>
                    <TableCell>{row.departments}</TableCell>
                    <TableCell>{row.goals}</TableCell>
                    <TableCell>{row.approved}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Department Goal</DialogTitle>
            <DialogDescription>
              Goals are departmental now. Save the goal here, then create tasks inside it for one person or the
              department queue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.department}
                  onValueChange={(value) => setForm((current) => ({ ...current, department: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {managedDepartments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cycle</Label>
                <Select
                  value={form.review_cycle_id}
                  onValueChange={(value) => setForm((current) => ({ ...current, review_cycle_id: value }))}
                >
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
            <div className="space-y-2">
              <Label>Goal Title</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void handleCreateGoal()} loading={saving}>
                Save Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
