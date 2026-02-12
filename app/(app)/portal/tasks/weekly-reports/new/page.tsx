"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Target,
  AlertTriangle,
  Loader2,
  Building2,
  Calendar,
  ChevronRight,
  Trophy,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

function WeeklyReportFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  // Form State
  const [id, setId] = useState<string | null>(null)
  const [department, setDepartment] = useState("")
  const [week, setWeek] = useState(0)
  const [year, setYear] = useState(new Date().getFullYear())
  const [workDone, setWorkDone] = useState("")
  const [challenges, setChallenges] = useState("")
  const [goals, setGoals] = useState<string[]>([])
  const [newGoal, setNewGoal] = useState("")

  // Verification State
  const [currentActions, setCurrentActions] = useState<any[]>([])
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      setProfile(p)

      // Get params or defaults
      const pWeek = searchParams.get("week")
      const pYear = searchParams.get("year")
      const pDept = searchParams.get("dept")

      const currentWeek = pWeek ? parseInt(pWeek) : new Date().getMonth() * 4 + Math.ceil(new Date().getDate() / 7)
      const currentYear = pYear ? parseInt(pYear) : new Date().getFullYear()
      const currentDept = pDept || p?.department || ""

      setWeek(currentWeek)
      setYear(currentYear)
      setDepartment(currentDept)

      // Check if editing
      if (pWeek && pYear && currentDept) {
        const { data: existing } = await supabase
          .from("weekly_reports")
          .select("*")
          .eq("week_number", currentWeek)
          .eq("year", currentYear)
          .eq("department", currentDept)
          .single()

        if (existing) {
          setId(existing.id)
          setWorkDone(existing.work_done || "")
          setChallenges(existing.challenges || "")
          // Try to parse goals if they are stored as JSON or newline string
          if (existing.tasks_new_week) {
            setGoals(existing.tasks_new_week.split("\n").filter(Boolean))
          }
          setVerified(true) // If editing, assume already verified once
        }
      }

      // Fetch current week's actions for verification
      const { data: actions } = await supabase
        .from("tasks")
        .select("*")
        .eq("department", currentDept)
        .eq("category", "weekly_action")
        .eq("week_number", currentWeek)
        .eq("year", currentYear)

      setCurrentActions(actions || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load form data")
    } finally {
      setLoading(false)
    }
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    setGoals([...goals, newGoal.trim()])
    setNewGoal("")
  }

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index))
  }

  const getNextWeekParams = (w: number, y: number) => {
    if (w >= 52) return { week: 1, year: y + 1 }
    return { week: w + 1, year: y }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!verified && currentActions.length > 0) {
      toast.error("Please verify current week's actions first")
      return
    }
    if (!workDone.trim()) {
      toast.error("Please describe work done")
      return
    }

    setSaving(true)
    try {
      const reportData = {
        department,
        week_number: week,
        year,
        work_done: workDone,
        challenges,
        tasks_new_week: goals.join("\n"),
        status: "submitted",
        user_id: profile?.id,
      }

      let error
      if (id) {
        const { error: err } = await supabase.from("weekly_reports").update(reportData).eq("id", id)
        error = err
      } else {
        const { error: err } = await supabase.from("weekly_reports").insert(reportData)
        error = err
      }

      if (error) throw error

      // SYNC LOGIC: Convert goals to actions for next week - ONLY for new reports to avoid duplication on edits
      if (goals.length > 0 && !id) {
        const { week: nextWeek, year: nextYear } = getNextWeekParams(week, year)

        const actionPayloads = goals.map((title) => ({
          title,
          department,
          category: "weekly_action",
          priority: "medium",
          status: "pending",
          week_number: nextWeek,
          year: nextYear,
          assigned_by: profile?.id,
        }))

        const { error: syncError } = await supabase.from("tasks").insert(actionPayloads)
        if (syncError) console.error("Sync Error:", syncError)
      }

      toast.success(id ? "Report updated" : "Report submitted successfully")
      router.push("/portal/tasks/weekly-reports")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to submit report")
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/portal/tasks/weekly-reports"
          className="text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Reports</span>
        </Link>
        <Badge
          variant="outline"
          className="bg-background/50 border-primary/20 flex items-center gap-2 px-3 py-1 backdrop-blur-sm"
        >
          <Calendar className="text-primary h-3 w-3" />
          Week {week}, {year}
        </Badge>
      </div>

      <PageHeader
        title={id ? "Edit Weekly Report" : "Submit Weekly Report"}
        description={`Progress update for ${department} department`}
        icon={Trophy}
      />

      <form onSubmit={handleSubmit} className="space-y-8 pb-20">
        {/* Step 1: Verification */}
        <Card className="overflow-hidden border-2 border-orange-500/20 bg-orange-500/5 shadow-sm">
          <CardHeader className="border-b border-orange-500/10 bg-orange-500/10 p-4 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-500/20 p-2">
                  <CheckCircle2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Step 1: Action Progress Verification</CardTitle>
                  <CardDescription>Review status of actions assigned for this week</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {currentActions.length === 0 ? (
              <div className="text-muted-foreground bg-muted/20 rounded-lg py-6 text-center italic">
                No specific actions were tracked for this week.
                <div className="mt-2">
                  <Button type="button" variant="link" onClick={() => setVerified(true)}>
                    Skip Verification
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  {currentActions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-card/50 flex items-center justify-between rounded-lg border p-3 shadow-sm"
                    >
                      <span className="text-sm font-medium">{action.title}</span>
                      <Badge variant={action.status === "completed" ? "default" : "secondary"} className="capitalize">
                        {action.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="flex items-center space-x-2 border-t border-orange-100 pt-4">
                  <Checkbox
                    id="verified"
                    checked={verified}
                    onCheckedChange={(checked) => setVerified(checked as boolean)}
                    className="h-5 w-5 border-orange-500/50 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600"
                  />
                  <label
                    htmlFor="verified"
                    className="text-foreground text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I have reviewed and confirmed the status of this week's actions.
                  </label>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-8 md:col-span-2">
            {/* Work Done */}
            <Card className="border-2 shadow-sm">
              <CardHeader className="border-b bg-blue-500/10 p-4 px-6">
                <CardTitle className="flex items-center gap-2 text-lg text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Work Done
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Textarea
                  placeholder="Enter summary of work completed this week..."
                  className="min-h-[250px] resize-none text-base leading-relaxed focus-visible:ring-blue-500"
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  required
                />
              </CardContent>
            </Card>

            {/* Challenges */}
            <Card className="border-2 shadow-sm">
              <CardHeader className="border-b bg-red-500/10 p-4 px-6">
                <CardTitle className="flex items-center gap-2 text-lg text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Challenges & Obstacles
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Textarea
                  placeholder="Any blockers or challenges encountered?"
                  className="min-h-[150px] resize-none text-base leading-relaxed focus-visible:ring-red-500"
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            {/* Next Week Goals */}
            <Card className="border-2 border-green-500/20 shadow-sm">
              <CardHeader className="border-b bg-green-500/10 p-4 px-6">
                <CardTitle className="flex items-center gap-2 text-lg text-green-600 dark:text-green-400">
                  <Target className="h-5 w-5" />
                  Next Week Goals
                </CardTitle>
                <CardDescription>These will be synced to the Action Tracker</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="min-h-[100px] space-y-3">
                  {goals.map((goal, idx) => (
                    <div
                      key={idx}
                      className="group animate-in fade-in slide-in-from-right-2 flex items-start gap-2 duration-200"
                    >
                      <div className="flex flex-1 items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-2 px-3 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-400" />
                        {goal}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => removeGoal(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {goals.length === 0 && (
                    <div className="text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed py-6 text-center text-xs italic">
                      No goals added yet.
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a goal..."
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addGoal()
                      }
                    }}
                    className="h-10 text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={addGoal}
                    disabled={!newGoal.trim()}
                    className="h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary / Submit */}
            <div className="sticky top-6">
              <Card className="border-primary/20 bg-primary/5 border-2 shadow-md">
                <CardHeader className="bg-primary/10 border-b p-4 px-6">
                  <CardTitle className="text-lg">Submit Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Department:</span>
                      <span className="font-bold">{department}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Goals to Sync:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{goals.length}</span>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="h-12 w-full gap-2 text-lg shadow-lg"
                    disabled={saving || (!verified && currentActions.length > 0)}
                  >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    {id ? "Update Report" : "Submit Report"}
                  </Button>
                  {!verified && currentActions.length > 0 && (
                    <p className="text-center text-[10px] font-medium text-red-500">
                      Verification required before submission
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </PageWrapper>
  )
}

export default function WeeklyReportFormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      }
    >
      <WeeklyReportFormContent />
    </Suspense>
  )
}
