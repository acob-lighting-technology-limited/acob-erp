"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, ListOrdered, Sparkles } from "lucide-react"

interface Profile {
  id: string
  first_name: string
  last_name: string
  department: string
}

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
}

export function WeeklyReportAdminDialog({ isOpen, onClose, report, onSuccess }: WeeklyReportAdminDialogProps) {
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [formData, setFormData] = useState({
    user_id: "",
    department: "",
    week_number: new Date().getMonth() * 4 + 1, // rough estimate
    year: new Date().getFullYear(),
    work_done: "",
    tasks_new_week: "",
    challenges: "",
    status: "submitted",
  })

  const supabase = createClient()

  useEffect(() => {
    const fetchMetadata = async () => {
      // Fetch profiles for general reference
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, department")
        .order("last_name")
      if (profileData) setProfiles(profileData)

      // Fetch unique departments
      const { data: deptData } = await supabase.from("profiles").select("department").not("department", "is", null)
      if (deptData) {
        const uniqueDepts = Array.from(new Set(deptData.map((d) => d.department))).sort()
        setDepartments(uniqueDepts)
      }
    }
    fetchMetadata()
  }, [])

  useEffect(() => {
    if (report) {
      setFormData({
        user_id: report.user_id,
        department: report.department,
        week_number: report.week_number,
        year: report.year,
        work_done: report.work_done,
        tasks_new_week: report.tasks_new_week,
        challenges: report.challenges,
        status: report.status,
      })
    } else {
      // For new reports, we'll fetch the current user's ID
      const setupNewReport = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setFormData((prev) => ({
          ...prev,
          user_id: user?.id || "",
          department: "",
          week_number: Math.ceil(
            (new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
          ),
          year: new Date().getFullYear(),
          work_done: "",
          tasks_new_week: "",
          challenges: "",
          status: "submitted",
        }))
      }
      setupNewReport()
    }
  }, [report, isOpen])

  const handleSubmit = async () => {
    if (!formData.department || !formData.work_done) {
      toast.error("Please fill in required fields")
      return
    }

    setLoading(true)
    try {
      // Ensure we have a user_id if it's missing (e.g. session timed out or dev env)
      let submissionData = { ...formData }
      if (!submissionData.user_id) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          submissionData.user_id = user.id
        } else {
          throw new Error("User session not found. Please log in again.")
        }
      }

      if (report) {
        const { error } = await supabase.from("weekly_reports").update(submissionData).eq("id", report.id)
        if (error) throw error
        toast.success("Report updated")
      } else {
        const { error } = await supabase.from("weekly_reports").insert([submissionData])
        if (error) throw error
        toast.success("Report created")
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, field: keyof typeof formData) => {
    if (e.key === "Enter") {
      const value = formData[field] as string
      const lines = value.split("\n")
      const lastLine = lines[lines.length - 1]
      const match = lastLine.match(/^(\d+)\.\s/)

      if (match) {
        e.preventDefault()
        const nextNumber = parseInt(match[1]) + 1
        const newValue = value + "\n" + nextNumber + ". "
        setFormData((prev) => ({ ...prev, [field]: newValue }))
      }
    }
  }

  const applyNumbering = (field: keyof typeof formData) => {
    const value = formData[field] as string
    if (!value || !value.startsWith("1. ")) {
      setFormData((prev) => ({ ...prev, [field]: "1. " + value }))
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
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <SearchableSelect
                value={formData.department}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, department: val }))}
                options={departments.map((d) => ({ value: d, label: d }))}
                placeholder="Select department"
              />
            </div>
            <div className="space-y-2">
              <Label>Week / Year</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Week"
                  value={formData.week_number}
                  onChange={(e) => setFormData((prev) => ({ ...prev, week_number: parseInt(e.target.value) }))}
                  className="w-1/2"
                />
                <Input
                  type="number"
                  placeholder="Year"
                  value={formData.year}
                  onChange={(e) => setFormData((prev) => ({ ...prev, year: parseInt(e.target.value) }))}
                  className="w-1/2"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Work Accomplished</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyNumbering("work_done")}
                className="h-6 gap-1 text-[10px]"
              >
                <ListOrdered className="h-3 w-3" /> Auto-Number
              </Button>
            </div>
            <Textarea
              value={formData.work_done}
              onChange={(e) => setFormData((prev) => ({ ...prev, work_done: e.target.value }))}
              onKeyDown={(e) => handleTextareaKeyDown(e, "work_done")}
              placeholder="1. Completed the implementation..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Upcoming Objectives</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyNumbering("tasks_new_week")}
                className="h-6 gap-1 text-[10px]"
              >
                <ListOrdered className="h-3 w-3" /> Auto-Number
              </Button>
            </div>
            <Textarea
              value={formData.tasks_new_week}
              onChange={(e) => setFormData((prev) => ({ ...prev, tasks_new_week: e.target.value }))}
              onKeyDown={(e) => handleTextareaKeyDown(e, "tasks_new_week")}
              placeholder="1. Begin research on..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Critical Blockers</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyNumbering("challenges")}
                className="h-6 gap-1 text-[10px]"
              >
                <ListOrdered className="h-3 w-3" /> Auto-Number
              </Button>
            </div>
            <Textarea
              value={formData.challenges}
              onChange={(e) => setFormData((prev) => ({ ...prev, challenges: e.target.value }))}
              onKeyDown={(e) => handleTextareaKeyDown(e, "challenges")}
              placeholder="Describe any blockers..."
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : report ? "Update Report" : "Create Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
