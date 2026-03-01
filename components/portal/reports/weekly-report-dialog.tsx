"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

interface WeeklyReportDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: {
    week?: number
    year?: number
    dept?: string
  }
}

export function WeeklyReportDialog({ isOpen, onClose, onSuccess, initialData }: WeeklyReportDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [currentActions, setCurrentActions] = useState<any[]>([])
  const [isNextWeekActive, setIsNextWeekActive] = useState(false)
  const [lockState, setLockState] = useState<WeeklyReportLockState | null>(null)

  const [id, setId] = useState<string | null>(null)
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

  useEffect(() => {
    if (isOpen) {
      setupDialog()
    }
  }, [isOpen, initialData])

  useEffect(() => {
    const fetchLockState = async () => {
      const state = await fetchWeeklyReportLockState(supabase, formData.week_number, formData.year)
      setLockState(state)
    }
    fetchLockState()
  }, [formData.week_number, formData.year])

  async function setupDialog() {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      setProfile(p)

      const week = initialData?.week || currentOfficeWeek.week
      const year = initialData?.year || currentOfficeWeek.year
      const dept = initialData?.dept || p?.department || ""

      // Fetch existing report
      const { data: existing } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("week_number", week)
        .eq("year", year)
        .eq("department", dept)
        .maybeSingle()

      setId(existing?.id || null)
      setFormData({
        user_id: user.id || "",
        department: dept,
        week_number: week,
        year: year,
        work_done: existing?.work_done || "",
        tasks_new_week: existing?.tasks_new_week || "",
        challenges: existing?.challenges || "",
        status: "submitted",
      })

      // Meta checks
      const { data: nextActions } = await supabase
        .from("action_items")
        .select("*")
        .eq("department", dept)
        .eq("week_number", week)
        .eq("year", year)
      if (nextActions) {
        setIsNextWeekActive(nextActions.some((a) => a.status !== "pending"))
        if (nextActions.length > 0 && !existing) {
          const syncedText = nextActions.map((a, i) => `${i + 1}. ${a.title}`).join("\n")
          setFormData((prev) => ({ ...prev, tasks_new_week: syncedText }))
        }
      }

      const { data: current } = await supabase
        .from("action_items")
        .select("*")
        .eq("department", dept)
        .eq("week_number", week)
        .eq("year", year)
      setCurrentActions(current || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    const state = await fetchWeeklyReportLockState(supabase, formData.week_number, formData.year)
    setLockState(state)
    if (state.isLocked) {
      toast.error("This report week is locked. Contact admin for a temporary unlock.")
      return
    }

    if (!formData.work_done.trim()) {
      toast.error("Please describe work done")
      return
    }
    setSaving(true)
    try {
      let reportId = id
      if (id) {
        const { error } = await supabase.from("weekly_reports").update(formData).eq("id", id)
        if (error) throw error
      } else {
        const { data: newReport, error } = await supabase
          .from("weekly_reports")
          .insert([formData])
          .select("id")
          .single()
        if (error) throw error
        reportId = newReport.id
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
              assigned_by: formData.user_id,
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
                assigned_by: formData.user_id,
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
      toast.success("Success")
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
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
            {id ? "Edit Weekly Report" : "Submit Weekly Report"}
            <Sparkles className="text-primary h-4 w-4" />
          </DialogTitle>
          <DialogDescription>
            Progress update for <span className="text-primary font-semibold">{formData.department}</span> — Week{" "}
            {formData.week_number}, {formData.year}
          </DialogDescription>
          {lockState?.isLocked && (
            <p className="text-destructive text-xs">
              Locked after meeting date {lockState.meetingDate}. Editing is now closed for this week.
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 py-4">
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
                    Locked: Next week's tracker is already active.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || loading || !!lockState?.isLocked}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {id ? "Update Report" : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
