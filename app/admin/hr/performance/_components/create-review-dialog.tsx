"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Zap } from "lucide-react"
import { toast } from "sonner"
import { FormFieldGroup } from "@/components/ui/patterns"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { QueryClient } from "@tanstack/react-query"

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

interface CreateReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  queryClient?: QueryClient
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
  return { users: usersData || [], cycles: cyclesData.cycles || [] }
}

export function CreateReviewDialog({ open, onOpenChange, queryClient }: CreateReviewDialogProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [loadingScore, setLoadingScore] = useState(false)
  const [formData, setFormData] = useState({
    user_id: "",
    review_cycle_id: "",
    strengths: "",
    areas_for_improvement: "",
    manager_comments: "",
    kpi_score: 0,
    cbt_score: 0,
    attendance_score: 0,
  })
  const [competencies, setCompetencies] = useState<BehaviourCompetencies>({
    collaboration: 0,
    accountability: 0,
    communication: 0,
    teamwork: 0,
    loyalty: 0,
    professional_conduct: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.performanceCreateData(),
    queryFn: () => fetchPerformanceCreateData(supabase),
    enabled: open,
  })

  const users = data?.users ?? []
  const cycles = data?.cycles ?? []
  const behaviourAvg = Math.round(
    Object.values(competencies).reduce((sum, value) => sum + value, 0) / Object.keys(competencies).length
  )
  const finalScore = Math.round(
    formData.kpi_score * 0.7 + formData.cbt_score * 0.1 + formData.attendance_score * 0.1 + behaviourAvg * 0.1
  )

  async function autoFillScores() {
    if (!formData.user_id || !formData.review_cycle_id) return toast.error("Select employee and review cycle first")
    setLoadingScore(true)
    try {
      const res = await fetch(
        `/api/hr/performance/score?user_id=${formData.user_id}&cycle_id=${formData.review_cycle_id}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const scoreData = json.data
      setFormData((prev) => ({
        ...prev,
        kpi_score: scoreData.kpi_score ?? 0,
        cbt_score: scoreData.cbt_score ?? 0,
        attendance_score: scoreData.attendance_score ?? 0,
      }))
      toast.success("KPI and attendance scores auto-filled from ERP data")
    } catch {
      toast.error("Failed to auto-fill scores")
    } finally {
      setLoadingScore(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await fetch("/api/hr/performance/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          overall_rating: finalScore,
          behaviour_score: behaviourAvg,
          behaviour_competencies: competencies,
        }),
      })
      const responseData = await response.json()
      if (!response.ok) throw new Error(responseData.error || "Failed to create review")

      toast.success("Performance review created successfully")
      await queryClient?.invalidateQueries({ queryKey: QUERY_KEYS.performanceCreateData() })
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create review")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Performance Review
          </DialogTitle>
          <DialogDescription>Evaluate an employee&apos;s performance without leaving the dashboard.</DialogDescription>
        </DialogHeader>

        {isLoading ? null : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Form</CardTitle>
                <CardDescription>Complete review details and submit for records.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormFieldGroup label="Employee">
                  <Select
                    value={formData.user_id}
                    onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                  >
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

                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Performance Score Components</h3>
                    <Button type="button" variant="outline" size="sm" onClick={autoFillScores} disabled={loadingScore}>
                      <Zap className="mr-1 h-3 w-3" />
                      Auto-fill from ERP
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormFieldGroup label="KPI Score">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.kpi_score}
                        onChange={(e) => setFormData({ ...formData, kpi_score: parseInt(e.target.value, 10) || 0 })}
                      />
                    </FormFieldGroup>
                    <FormFieldGroup label="CBT Score">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.cbt_score}
                        onChange={(e) => setFormData({ ...formData, cbt_score: parseInt(e.target.value, 10) || 0 })}
                      />
                    </FormFieldGroup>
                    <FormFieldGroup label="Attendance Score">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.attendance_score}
                        onChange={(e) =>
                          setFormData({ ...formData, attendance_score: parseInt(e.target.value, 10) || 0 })
                        }
                      />
                    </FormFieldGroup>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(competencies).map(([key, value]) => (
                    <FormFieldGroup key={key} label={key.replace("_", " ")}>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) =>
                          setCompetencies((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) || 0 }))
                        }
                      />
                    </FormFieldGroup>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormFieldGroup label="Strengths">
                    <Textarea
                      value={formData.strengths}
                      onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                      rows={3}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Areas for Improvement">
                    <Textarea
                      value={formData.areas_for_improvement}
                      onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
                      rows={3}
                    />
                  </FormFieldGroup>
                </div>

                <FormFieldGroup label="Manager Comments">
                  <Textarea
                    value={formData.manager_comments}
                    onChange={(e) => setFormData({ ...formData, manager_comments: e.target.value })}
                    rows={4}
                  />
                </FormFieldGroup>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Final Score</p>
                  <p className="text-3xl font-bold">{finalScore}%</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Create Review
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
