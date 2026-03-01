"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, ListOrdered, Sparkles } from "lucide-react"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { fetchWeeklyReportLockState, type WeeklyReportLockState } from "@/lib/weekly-report-lock"

interface WeeklyReport {
  id: string
  department: string
  week_number: number
  year: number
  work_done: string
  tasks_new_week: string
  challenges: string
  status: string
  user_id: string
}

interface WeeklyReportAdminDialogProps {
  isOpen: boolean
  onClose: () => void
  report?: WeeklyReport | null
  onSuccess: () => void
  currentUser: {
    id: string
    role: string
    department: string | null
  }
}

export function WeeklyReportAdminDialog({
  isOpen,
  onClose,
  report,
  onSuccess,
  currentUser,
}: WeeklyReportAdminDialogProps) {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const [currentActions, setCurrentActions] = useState<any[]>([])
  const [isNextWeekActive, setIsNextWeekActive] = useState(false)
  const [lockState, setLockState] = useState<WeeklyReportLockState | null>(null)
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [formData, setFormData] = useState({
    user_id: "",
    department: "",
    week_number: currentOfficeWeek.week,
    year: currentOfficeWeek.year,
    work_done: "",
    tasks_new_week: "",
    challenges: "",
    status: "submitted",
  })

  const supabase = createClient()
  const isLead = currentUser.role === "lead"

  useEffect(() => {
    const fetchMetadata = async () => {
      if (isLead && currentUser.department) {
        setDepartments([currentUser.department])
        return
      }
      const { data: deptData } = await supabase.from("profiles").select("department").not("department", "is", null)
      if (deptData) {
        const uniqueDepts = Array.from(new Set(deptData.map((d) => d.department))).sort()
        setDepartments(uniqueDepts as string[])
      }
    }
    fetchMetadata()
  }, [currentUser.department, isLead])

  useEffect(() => {
    const fetchLockState = async () => {
      const state = await fetchWeeklyReportLockState(supabase, formData.week_number, formData.year)
      setLockState(state)
    }
    fetchLockState()
  }, [formData.week_number, formData.year])

  useEffect(() => {
    const fetchStatus = async () => {
      if (!formData.department) return

      // For "Add Report", prefer existing weekly report content for this dept/week/year.
      // If none exists, fall back to syncing tasks from action items.
      let hasExistingWeeklyReport = false
      if (!report) {
        const { data: existingReport } = await supabase
          .from("weekly_reports")
          .select("user_id, work_done, tasks_new_week, challenges, status")
          .eq("department", formData.department)
          .eq("week_number", formData.week_number)
          .eq("year", formData.year)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingReport) {
          hasExistingWeeklyReport = true
          setFormData((prev) => ({
            ...prev,
            user_id: existingReport.user_id || prev.user_id || currentUser.id || "",
            work_done: existingReport.work_done || "",
            tasks_new_week: existingReport.tasks_new_week || "",
            challenges: existingReport.challenges || "",
            status: existingReport.status || prev.status,
          }))
        } else {
          // Critical reset: moving to a week with no report should not keep stale text
          setFormData((prev) => ({
            ...prev,
            user_id: currentUser.id || prev.user_id || "",
            work_done: "",
            tasks_new_week: "",
            challenges: "",
            status: "submitted",
          }))
        }
      }

      const { data } = await supabase
        .from("action_items")
        .select("title, status")
        .eq("department", formData.department)
        .eq("week_number", formData.week_number)
        .eq("year", formData.year)

      if (data) {
        setIsNextWeekActive(data.some((a) => a.status !== "pending"))
        if (data.length > 0 && !report && !hasExistingWeeklyReport) {
          // Only auto-sync tasks from action items when there is no existing weekly report to mirror.
          const syncedText = data.map((a, i) => `${i + 1}. ${a.title}`).join("\n")
          setFormData((prev) => ({ ...prev, tasks_new_week: syncedText }))
        }
      }
    }
    const fetchCurrent = async () => {
      if (!formData.department) return
      const { data } = await supabase
        .from("action_items")
        .select("*")
        .eq("department", formData.department)
        .eq("week_number", formData.week_number)
        .eq("year", formData.year)
      if (data) setCurrentActions(data)
    }
    fetchStatus()
    fetchCurrent()
  }, [currentUser.id, formData.department, formData.week_number, formData.year, report])

  useEffect(() => {
    if (report) {
      setFormData({
        user_id: report.user_id,
        department: isLead ? currentUser.department || report.department : report.department,
        week_number: report.week_number,
        year: report.year,
        work_done: report.work_done || "",
        tasks_new_week: report.tasks_new_week || "",
        challenges: report.challenges || "",
        status: report.status || "submitted",
      })
    } else {
      setFormData((prev) => ({
        ...prev,
        user_id: currentUser.id || "",
        department: isLead ? currentUser.department || "" : "",
        week_number: currentOfficeWeek.week,
        year: currentOfficeWeek.year,
        work_done: "",
        tasks_new_week: "",
        challenges: "",
      }))
    }
  }, [currentUser.department, currentUser.id, currentOfficeWeek.week, currentOfficeWeek.year, isLead, report, isOpen])

  const handleSubmit = async () => {
    const state = await fetchWeeklyReportLockState(supabase, formData.week_number, formData.year)
    setLockState(state)
    if (state.isLocked) {
      toast.error("This report week is locked. Ask admin to set a temporary unlock window.")
      return
    }

    if (!formData.department || !formData.work_done) {
      toast.error("Required: Department and Work Done")
      return
    }
    setLoading(true)
    try {
      if (isLead && report && report.user_id !== currentUser.id) {
        throw new Error("You can only edit reports you created")
      }

      const safeFormData = {
        ...formData,
        user_id: isLead ? currentUser.id : formData.user_id,
        department: isLead ? currentUser.department || formData.department : formData.department,
      }

      let reportId = report?.id
      if (report) {
        const { error } = await supabase.from("weekly_reports").update(safeFormData).eq("id", report.id)
        if (error) throw error
        toast.success("Updated")
      } else {
        const { data: newReport, error } = await supabase
          .from("weekly_reports")
          .insert([safeFormData])
          .select("id")
          .single()
        if (error) throw error
        reportId = newReport.id
        toast.success("Created")
      }

      if (!isNextWeekActive) {
        const payload: any[] = []
        currentActions
          .filter((a) => a.status === "not_started" || a.status === "in_progress")
          .forEach((a) => {
            payload.push({
              title: a.title,
              department: a.department,
              description: a.description,
              status: "pending",
              week_number: formData.week_number,
              year: formData.year,
              original_week: a.original_week || a.week_number,
              original_year: a.original_year || a.year,
              assigned_by: safeFormData.user_id,
              report_id: reportId,
            })
          })
        formData.tasks_new_week
          .split("\n")
          .filter((l) => l.trim().length > 0)
          .forEach((l) => {
            const title = l.replace(/^\d+\.\s/, "").trim()
            if (title)
              payload.push({
                title,
                department: formData.department,
                status: "pending",
                week_number: formData.week_number,
                year: formData.year,
                original_week: formData.week_number,
                original_year: formData.year,
                assigned_by: safeFormData.user_id,
                report_id: reportId,
              })
          })
        await supabase
          .from("action_items")
          .delete()
          .eq("department", formData.department)
          .eq("week_number", formData.week_number)
          .eq("year", formData.year)
          .eq("status", "pending")
        if (payload.length > 0) await supabase.from("action_items").insert(payload)
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const applyNumbering = (field: keyof typeof formData) => {
    const val = formData[field] as string
    if (!val || !val.startsWith("1. ")) setFormData((p) => ({ ...p, [field]: "1. " + val }))
  }

  const handleKey = (e: React.KeyboardEvent, field: keyof typeof formData) => {
    if (e.key === "Enter") {
      const val = formData[field] as string
      const last = val.split("\n").pop() || ""
      const match = last.match(/^(\d+)\.\s/)
      if (match) {
        e.preventDefault()
        setFormData((p) => ({ ...p, [field]: val + "\n" + (parseInt(match[1]) + 1) + ". " }))
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {report ? "Edit Weekly Report" : "Create Weekly Report"}
            <Sparkles className="h-4 w-4 text-blue-500" />
          </DialogTitle>
          <DialogDescription>
            {report ? "Update this weekly report's details" : "Add a new departmental weekly report"}
          </DialogDescription>
          {lockState?.isLocked && (
            <p className="text-destructive text-xs">
              Locked after meeting date {lockState.meetingDate}. Editing is now closed for this week.
            </p>
          )}
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <SearchableSelect
                value={formData.department}
                onValueChange={(val) => setFormData((p) => ({ ...p, department: val }))}
                options={departments.map((d) => ({ value: d, label: d }))}
                placeholder="Select department"
                disabled={isLead}
              />
            </div>
            <div className="space-y-2">
              <Label>Week / Year</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={formData.week_number}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, week_number: parseInt(e.target.value) || p.week_number }))
                  }
                  className="w-1/2"
                />
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData((p) => ({ ...p, year: parseInt(e.target.value) || p.year }))}
                  className="w-1/2"
                />
              </div>
            </div>
          </div>

          {["work_done", "tasks_new_week", "challenges"].map((f) => (
            <div key={f} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="capitalize">{f.replace(/_/g, " ")}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyNumbering(f as any)}
                  className="h-6 gap-1 text-[10px]"
                >
                  <ListOrdered className="h-3 w-3" /> Auto-Number
                </Button>
              </div>
              <Textarea
                value={formData[f as keyof typeof formData]}
                onChange={(e) => setFormData((p) => ({ ...p, [f]: e.target.value }))}
                onKeyDown={(e) => handleKey(e, f as any)}
                placeholder={`1. ...`}
                rows={4}
                disabled={f === "tasks_new_week" && isNextWeekActive}
              />
              {f === "tasks_new_week" && isNextWeekActive && (
                <p className="text-muted-foreground text-[10px] italic">
                  Locked: Next week's tracker already has activity.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !!lockState?.isLocked}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {report ? "Update Report" : "Create Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
