"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Target, Plus, CheckCircle, Clock, XCircle } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Goal } from "./page"
import { ChevronDown } from "lucide-react"

import { logger } from "@/lib/logger"

const log = logger("dashboard-goals-goals-content")

interface GoalsContentProps {
  initialGoals: Goal[]
  userId: string
}

export function GoalsContent({ initialGoals, userId }: GoalsContentProps) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [linkedTasks, setLinkedTasks] = useState<
    Record<
      string,
      Array<{
        id: string
        title: string
        status: string
        work_item_number?: string | null
        source_type?: string | null
      }>
    >
  >({})
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    target_value: 100,
    priority: "medium",
    due_date: "",
  })

  async function fetchGoals() {
    try {
      const response = await fetch("/api/hr/performance/goals")
      const data = await response.json()
      if (data.goals) {
        setGoals(data.goals)
      }
    } catch (error) {
      log.error("Error fetching goals:", error)
    }
  }

  useEffect(() => {
    async function loadLinkedTasks() {
      const approvedGoals = goals.filter((goal) => goal.approval_status === "approved")
      const entries = await Promise.all(
        approvedGoals.map(async (goal) => {
          const response = await fetch(`/api/hr/performance/goals/${goal.id}/tasks`, { cache: "no-store" })
          const payload = (await response.json().catch(() => null)) as {
            data?: Array<{
              id: string
              title: string
              status: string
              work_item_number?: string | null
              source_type?: string | null
            }>
          } | null
          return [goal.id, payload?.data || []] as const
        })
      )
      setLinkedTasks(Object.fromEntries(entries))
    }
    void loadLinkedTasks()
  }, [goals])

  async function handleAddGoal() {
    setSaving(true)
    try {
      const response = await fetch("/api/hr/performance/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newGoal,
          user_id: userId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create goal")
      }

      toast.success("Goal created successfully")

      setShowAddDialog(false)
      setNewGoal({ title: "", description: "", target_value: 100, priority: "medium", due_date: "" })
      fetchGoals()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create goal")
    } finally {
      setSaving(false)
    }
  }

  async function updateGoalProgress(goalId: string, achievedValue: number) {
    try {
      const response = await fetch("/api/hr/performance/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: goalId,
          achieved_value: achievedValue,
          status: achievedValue >= 100 ? "completed" : "in_progress",
        }),
      })

      if (!response.ok) throw new Error("Failed to update goal")

      toast.success("Goal progress updated")
      fetchGoals()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update goal")
    }
  }

  async function handleRequestApproval(goalId: string) {
    try {
      const response = await fetch("/api/hr/performance/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goalId, approval_status: "pending" }),
      })
      if (!response.ok) throw new Error("Failed to request approval")
      toast.success("Approval request sent to your line manager")
      fetchGoals()
    } catch {
      toast.error("Failed to request approval")
    }
  }

  function getApprovalBadge(approval_status: string) {
    if (approval_status === "approved")
      return (
        <Badge className="flex items-center gap-1 bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3" /> KPI Approved
        </Badge>
      )
    if (approval_status === "rejected")
      return (
        <Badge className="flex items-center gap-1 bg-red-100 text-red-800">
          <XCircle className="h-3 w-3" /> KPI Rejected
        </Badge>
      )
    return (
      <Badge className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
        <Clock className="h-3 w-3" /> Pending Approval
      </Badge>
    )
  }

  function getStatusBadge(status: string) {
    const colors: { [key: string]: string } = {
      not_started: "bg-gray-100 text-gray-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  function getPriorityBadge(priority: string) {
    const colors: { [key: string]: string } = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-red-100 text-red-800",
    }
    return colors[priority] || "bg-gray-100 text-gray-800"
  }

  const inProgress = goals.filter((g) => g.status === "in_progress").length
  const completed = goals.filter((g) => g.status === "completed").length

  function toggleGoalTasks(goalId: string) {
    setExpandedGoals((current) => ({
      ...current,
      [goalId]: !current[goalId],
    }))
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="My Goals"
        description="Track and manage your performance goals"
        icon={Target}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
        actions={
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Goal</DialogTitle>
                <DialogDescription>Set a new performance goal to track</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                    placeholder="e.g., Complete React certification"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                    placeholder="Describe your goal..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={newGoal.priority}
                      onValueChange={(value) => setNewGoal({ ...newGoal, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newGoal.due_date}
                      onChange={(e) => setNewGoal({ ...newGoal, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddGoal} disabled={saving || !newGoal.title} className="w-full">
                  {saving ? "Creating..." : "Create Goal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold sm:text-2xl">{goals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-600 sm:text-2xl">{inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-600 sm:text-2xl">{completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-lg font-semibold">No goals yet</h3>
            <p className="text-muted-foreground mb-4">Create your first performance goal to get started</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {goal.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Target className="h-5 w-5" />
                    )}
                    {goal.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getPriorityBadge(goal.priority)}>{goal.priority}</Badge>
                    <Badge className={getStatusBadge(goal.status)}>{goal.status.replace("_", " ")}</Badge>
                    {getApprovalBadge(goal.approval_status ?? "pending")}
                  </div>
                </div>
                {goal.description && <CardDescription>{goal.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const goalTasks = linkedTasks[goal.id] || []
                    const completedTasks = goalTasks.filter((task) => task.status === "completed").length
                    const taskProgress =
                      goalTasks.length > 0 ? Math.round((completedTasks / goalTasks.length) * 100) : null
                    const progressValue = taskProgress ?? (goal.achieved_value || 0)
                    const isExpanded = Boolean(expandedGoals[goal.id])
                    return (
                      <>
                        <div>
                          <div className="mb-2 flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{progressValue}%</span>
                          </div>
                          <Progress value={progressValue} />
                        </div>
                        {goalTasks.length === 0 && goal.status !== "completed" && (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="Update progress %"
                              className="w-32"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateGoalProgress(goal.id, parseInt((e.target as HTMLInputElement).value))
                                }
                              }}
                            />
                            <Button variant="outline" size="sm" onClick={() => updateGoalProgress(goal.id, 100)}>
                              Mark Complete
                            </Button>
                          </div>
                        )}
                        {goalTasks.length === 0 ? (
                          <p className="text-sm text-amber-700">No linked tasks - progress is self-reported</p>
                        ) : (
                          <div className="space-y-3">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left"
                              onClick={() => toggleGoalTasks(goal.id)}
                            >
                              <div>
                                <div className="font-medium">Linked Tasks</div>
                                <div className="text-sm text-slate-500">
                                  {completedTasks} of {goalTasks.length} tasks completed ({taskProgress}%)
                                </div>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                            {isExpanded ? (
                              <div className="space-y-2 pt-1">
                                {goalTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                  >
                                    <div>
                                      <div className="font-mono text-xs text-slate-500">
                                        {task.work_item_number || "Task"}
                                      </div>
                                      <div className="font-medium">{task.title}</div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Badge variant="outline">{task.status.replace("_", " ")}</Badge>
                                      {task.source_type ? (
                                        <Badge variant="outline">{task.source_type.replace("_", " ")}</Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </>
                    )
                  })()}
                  {goal.due_date && (
                    <p className="text-muted-foreground text-sm">Due: {new Date(goal.due_date).toLocaleDateString()}</p>
                  )}
                  {/* Approval action — only show for pending goals not yet completed */}
                  {(goal.approval_status ?? "pending") === "pending" && goal.status !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 w-full sm:w-auto"
                      onClick={() => handleRequestApproval(goal.id)}
                    >
                      Request KPI Approval
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
