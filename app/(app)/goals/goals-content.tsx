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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Goal } from "./page"

type GoalsContentProps = {
  initialGoals: Goal[]
  canCreateGoal?: boolean
  managedDepartments?: string[]
  pageTitle?: string
  pageDescription?: string
  backHref?: string
  backLabel?: string
  showCreateTaskAction?: boolean
  summaryCards?: Array<{ label: string; value: string | number }>
}

const INITIAL_FORM = {
  department: "",
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
}

function getApprovalLabel(status: Goal["approval_status"]) {
  if (status === "approved") return "Approved"
  if (status === "rejected") return "Rejected"
  return "Pending"
}

function getApprovalClass(status: Goal["approval_status"]) {
  if (status === "approved") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  if (status === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
}

export function GoalsContent({
  initialGoals,
  canCreateGoal = false,
  managedDepartments = [],
  pageTitle = "Department Goals",
  pageDescription = "View the department goals already set by your lead.",
  backHref = "/pms",
  backLabel = "Back to PMS",
  showCreateTaskAction = false,
  summaryCards = [],
}: GoalsContentProps) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [searchQuery, setSearchQuery] = useState("")
  const [cycleFilter, setCycleFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const availableDepartments = useMemo(
    () =>
      (managedDepartments.length > 0
        ? managedDepartments
        : Array.from(new Set(goals.map((goal) => goal.department).filter(Boolean) as string[]))
      ).sort((left, right) => left.localeCompare(right)),
    [goals, managedDepartments]
  )

  const filteredGoals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return goals.filter((goal) => {
      const matchesQuery =
        !query ||
        [goal.title, goal.description, goal.department, goal.priority, goal.status, goal.cycle?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesCycle = cycleFilter === "all" || (goal.cycle?.name || "-") === cycleFilter
      return matchesQuery && matchesCycle
    })
  }, [cycleFilter, goals, searchQuery])

  const cycleOptions = useMemo(
    () => Array.from(new Set(goals.map((goal) => goal.cycle?.name).filter(Boolean) as string[])).sort(),
    [goals]
  )

  async function handleCreateGoal() {
    if (!form.department || !form.title) {
      toast.error("Department and goal title are required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/hr/performance/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = (await response.json().catch(() => null)) as { data?: Goal; error?: string } | null
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to create goal")
      }

      setGoals((current) => [payload.data as Goal, ...current])
      setForm(INITIAL_FORM)
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
        title={pageTitle}
        description={pageDescription}
        icon={Target}
        backLink={{ href: backHref, label: backLabel }}
        actions={
          canCreateGoal ? (
            <Button size="sm" className="h-8 gap-2" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          ) : undefined
        }
      />

      {summaryCards.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">{card.label}</p>
                <p className="text-2xl font-semibold">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="mb-4 border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search goal, department, or status..."
                className="pl-10"
              />
            </div>
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                {cycleOptions.map((cycle) => (
                  <SelectItem key={cycle} value={cycle}>
                    {cycle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Goal Table</CardTitle>
          <CardDescription>
            {canCreateGoal
              ? "Department goals are created here, then tasks are created under each goal."
              : "Goals are created from the admin side by your department lead."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGoals.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No department goals found.</p>
          ) : (
            <Table className="min-w-[980px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Due Date</TableHead>
                  {showCreateTaskAction ? <TableHead className="text-right">Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGoals.map((goal, index) => (
                  <TableRow key={goal.id}>
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{goal.title}</p>
                        {goal.description ? <p className="text-muted-foreground text-xs">{goal.description}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>{goal.department || "-"}</TableCell>
                    <TableCell>{goal.cycle?.name || "-"}</TableCell>
                    <TableCell className="capitalize">{goal.priority}</TableCell>
                    <TableCell className="capitalize">{String(goal.status || "").replace("_", " ")}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getApprovalClass(goal.approval_status)}`}
                      >
                        {getApprovalLabel(goal.approval_status)}
                      </span>
                    </TableCell>
                    <TableCell>{goal.due_date ? new Date(goal.due_date).toLocaleDateString() : "-"}</TableCell>
                    {showCreateTaskAction ? (
                      <TableCell className="text-right">
                        <Link href={`/admin/tasks?goal_id=${encodeURIComponent(goal.id)}`}>
                          <Button size="sm" variant="outline">
                            Create Task
                          </Button>
                        </Link>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Department Goal</DialogTitle>
            <DialogDescription>
              Goals are now departmental. After saving the goal, create tasks under it and assign them from the task
              manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                  {availableDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}
                >
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
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                />
              </div>
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
