"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Target, Plus, CheckCircle } from "lucide-react"
import Link from "next/link"
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

interface GoalsContentProps {
  initialGoals: Goal[]
  userId: string
}

export function GoalsContent({ initialGoals, userId }: GoalsContentProps) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
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
      console.error("Error fetching goals:", error)
    }
  }

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
    } catch (error: any) {
      toast.error(error.message)
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
    } catch (error: any) {
      toast.error(error.message)
    }
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

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/profile" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Goals</h1>
          <p className="text-muted-foreground">Track and manage your performance goals</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
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
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completed}</div>
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
                  <div className="flex gap-2">
                    <Badge className={getPriorityBadge(goal.priority)}>{goal.priority}</Badge>
                    <Badge className={getStatusBadge(goal.status)}>{goal.status.replace("_", " ")}</Badge>
                  </div>
                </div>
                {goal.description && <CardDescription>{goal.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{goal.achieved_value || 0}%</span>
                    </div>
                    <Progress value={goal.achieved_value || 0} />
                  </div>
                  {goal.status !== "completed" && (
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
                  {goal.due_date && (
                    <p className="text-muted-foreground text-sm">Due: {new Date(goal.due_date).toLocaleDateString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
