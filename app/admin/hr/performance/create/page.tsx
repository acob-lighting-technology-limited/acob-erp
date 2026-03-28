"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { FormFieldGroup } from "@/components/ui/patterns"
import { QUERY_KEYS } from "@/lib/query-keys"
import { PageLoader } from "@/components/ui/query-states"

interface User {
  id: string
  first_name: string
  last_name: string
  department_id: string
}

interface ReviewCycle {
  id: string
  name: string
  review_type: string
}

interface PerformanceCreateData {
  users: User[]
  cycles: ReviewCycle[]
}

interface BehaviourCompetencies {
  collaboration: number
  accountability: number
  communication: number
  teamwork: number
  loyalty: number
  professional_conduct: number
}

async function fetchPerformanceCreateData(supabase: ReturnType<typeof createClient>): Promise<PerformanceCreateData> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_department_lead, department_id")
    .eq("id", user.id)
    .single()

  let usersQuery = supabase.from("profiles").select("id, first_name, last_name, department_id").neq("id", user.id)

  if (profile?.is_department_lead && !["developer", "admin", "super_admin"].includes(profile.role)) {
    usersQuery = usersQuery.eq("department_id", profile.department_id)
  }

  const { data: usersData } = await usersQuery

  const cyclesResponse = await fetch("/api/hr/performance/cycles")
  const cyclesData = await cyclesResponse.json()

  return {
    users: usersData || [],
    cycles: cyclesData.cycles || [],
  }
}

export default function CreateReviewPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    user_id: "",
    review_cycle_id: "",
    overall_rating: 0,
    strengths: "",
    areas_for_improvement: "",
    goals_achieved: 0,
    goals_total: 0,
    manager_comments: "",
    // PMS 4-component scores
    kpi_score: 0,
    cbt_score: 0,
    attendance_score: 0,
    behaviour_score: 0,
  })

  const [competencies, setCompetencies] = useState<BehaviourCompetencies>({
    collaboration: 0,
    accountability: 0,
    communication: 0,
    teamwork: 0,
    loyalty: 0,
    professional_conduct: 0,
  })

  const [loadingScore, setLoadingScore] = useState(false)

  const behaviourAvg = Math.round(
    Object.values(competencies).reduce((s, v) => s + v, 0) / Object.keys(competencies).length
  )

  const finalScore = Math.round(
    formData.kpi_score * 0.7 + formData.cbt_score * 0.1 + formData.attendance_score * 0.1 + behaviourAvg * 0.1
  )

  async function autoFillScores() {
    if (!formData.user_id || !formData.review_cycle_id) {
      toast.error("Select employee and review cycle first")
      return
    }
    setLoadingScore(true)
    try {
      const res = await fetch(
        `/api/hr/performance/score?user_id=${formData.user_id}&cycle_id=${formData.review_cycle_id}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const d = json.data
      setFormData((prev) => ({
        ...prev,
        kpi_score: d.kpi_score ?? 0,
        cbt_score: d.cbt_score ?? 0,
        attendance_score: d.attendance_score ?? 0,
      }))
      toast.success("KPI and attendance scores auto-filled from ERP data")
    } catch {
      toast.error("Failed to auto-fill scores")
    } finally {
      setLoadingScore(false)
    }
  }

  const { data, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.performanceCreateData(),
    queryFn: () => fetchPerformanceCreateData(supabase),
  })

  const users = data?.users ?? []
  const cycles = data?.cycles ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch("/api/hr/performance/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          behaviour_score: behaviourAvg,
          behaviour_competencies: competencies,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to create review")
      }

      toast.success("Performance review created successfully")

      router.push("/hr")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create review")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <PageHeader
        title="Create Performance Review"
        description="Evaluate an employee's performance"
        backLink={{ href: "/admin/hr", label: "Back to HR Dashboard" }}
        className="mb-6"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review Form
          </CardTitle>
          <CardDescription>Complete review details and submit for records.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee Selection */}
            <FormFieldGroup label="Employee">
              <Select value={formData.user_id} onValueChange={(value) => setFormData({ ...formData, user_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldGroup>

            {/* Review Cycle */}
            <FormFieldGroup label="Review Cycle">
              <Select
                value={formData.review_cycle_id}
                onValueChange={(value) => setFormData({ ...formData, review_cycle_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select review cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name} ({cycle.review_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldGroup>

            {/* PMS 4-Component Scoring */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Performance Score Components</h3>
                <Button type="button" variant="outline" size="sm" onClick={autoFillScores} loading={loadingScore}>
                  <Zap className="mr-1 h-3 w-3" />
                  Auto-fill from ERP
                </Button>
              </div>

              {/* KPI Achievement 70% */}
              <FormFieldGroup label="KPI Achievement Score (70%)">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.kpi_score}
                    onChange={(e) =>
                      setFormData({ ...formData, kpi_score: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })
                    }
                    className="w-24"
                  />
                  <span className="text-muted-foreground text-sm">/ 100</span>
                  <span className="text-muted-foreground text-xs">
                    (contributes {Math.round(formData.kpi_score * 0.7)}pts)
                  </span>
                </div>
              </FormFieldGroup>

              {/* CBT 10% */}
              <FormFieldGroup label="Knowledge Assessment / CBT Score (10%)">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.cbt_score}
                    onChange={(e) =>
                      setFormData({ ...formData, cbt_score: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })
                    }
                    className="w-24"
                  />
                  <span className="text-muted-foreground text-sm">/ 100</span>
                  <span className="text-muted-foreground text-xs">
                    (contributes {Math.round(formData.cbt_score * 0.1)}pts)
                  </span>
                </div>
              </FormFieldGroup>

              {/* Attendance 10% */}
              <FormFieldGroup label="Attendance Score (10%)">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.attendance_score}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        attendance_score: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                      })
                    }
                    className="w-24"
                  />
                  <span className="text-muted-foreground text-sm">/ 100</span>
                  <span className="text-muted-foreground text-xs">
                    (contributes {Math.round(formData.attendance_score * 0.1)}pts)
                  </span>
                </div>
              </FormFieldGroup>

              {/* Behavioural 10% — per-competency */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Behavioural Assessment (10%) — rate each competency 0–100</p>
                {(Object.keys(competencies) as Array<keyof BehaviourCompetencies>).map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-40 text-sm capitalize">{key.replace("_", " ")}</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={competencies[key]}
                      onChange={(e) =>
                        setCompetencies({
                          ...competencies,
                          [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-24"
                    />
                  </div>
                ))}
                <p className="text-muted-foreground text-xs">
                  Behaviour avg: {behaviourAvg} / 100 (contributes {Math.round(behaviourAvg * 0.1)}pts)
                </p>
              </div>

              {/* Final score preview */}
              <div className="bg-muted flex items-center justify-between rounded-md p-3">
                <span className="font-semibold">Computed Final Score</span>
                <span
                  className={`text-2xl font-bold ${finalScore >= 70 ? "text-green-600" : finalScore >= 50 ? "text-yellow-600" : "text-red-600"}`}
                >
                  {finalScore} / 100
                </span>
              </div>
            </div>

            {/* Goals */}
            <div className="grid grid-cols-2 gap-4">
              <FormFieldGroup label="Goals Achieved">
                <Input
                  type="number"
                  min="0"
                  value={formData.goals_achieved}
                  onChange={(e) => setFormData({ ...formData, goals_achieved: parseInt(e.target.value) || 0 })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Total Goals">
                <Input
                  type="number"
                  min="0"
                  value={formData.goals_total}
                  onChange={(e) => setFormData({ ...formData, goals_total: parseInt(e.target.value) || 0 })}
                />
              </FormFieldGroup>
            </div>

            {/* Strengths */}
            <FormFieldGroup label="Strengths">
              <Textarea
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                placeholder="What does this employee do well?"
                rows={3}
              />
            </FormFieldGroup>

            {/* Areas for Improvement */}
            <FormFieldGroup label="Areas for Improvement">
              <Textarea
                value={formData.areas_for_improvement}
                onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
                placeholder="What areas need development?"
                rows={3}
              />
            </FormFieldGroup>

            {/* Manager Comments */}
            <FormFieldGroup label="Additional Comments">
              <Textarea
                value={formData.manager_comments}
                onChange={(e) => setFormData({ ...formData, manager_comments: e.target.value })}
                placeholder="Any other feedback or notes..."
                rows={3}
              />
            </FormFieldGroup>

            <Button
              type="submit"
              className="w-full"
              disabled={saving || !formData.user_id || !formData.review_cycle_id}
            >
              {saving ? "Saving..." : "Submit Review"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
