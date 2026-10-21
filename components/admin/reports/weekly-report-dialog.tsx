"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { toast } from "sonner"
import { Loader2, Sparkles } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import { createClient } from "@/lib/supabase/client"
import { useAdminScopeOptional } from "@/components/admin-scope-context"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { autoNumberReportTexts, type ReportTexts } from "@/lib/reports/weekly-report-text"
import { WeeklyReportTextFields } from "@/components/reports/weekly-report-text-fields"
import { useDepartments } from "@/hooks/use-departments"
import { useWeeklyReportLockState } from "@/hooks/use-weekly-report-lock"
import { seedTexts, useWeeklyReportSeed } from "@/hooks/use-weekly-report-seed"

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

interface CurrentUser {
  id: string
  role: string
  department: string | null
  is_department_lead: boolean
}

interface WeeklyReportAdminDialogProps {
  isOpen: boolean
  onClose: () => void
  report?: WeeklyReport | null
  onSuccess: () => void
  currentUser: CurrentUser
}

export function WeeklyReportAdminDialog({
  isOpen,
  onClose,
  report,
  onSuccess,
  currentUser,
}: WeeklyReportAdminDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {/* Mounted only while open and keyed by report, so each open starts clean. */}
        {isOpen ? (
          <WeeklyReportAdminForm
            key={report?.id ?? "new"}
            report={report ?? null}
            onClose={onClose}
            onSuccess={onSuccess}
            currentUser={currentUser}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function WeeklyReportAdminForm({
  report,
  onClose,
  onSuccess,
  currentUser,
}: {
  report: WeeklyReport | null
  onClose: () => void
  onSuccess: () => void
  currentUser: CurrentUser
}) {
  const queryClient = useQueryClient()
  const adminScope = useAdminScopeOptional()
  const normalizedRole = (currentUser.role || "").trim().toLowerCase()
  const isAdminLikeRole =
    normalizedRole === "developer" || normalizedRole === "super_admin" || normalizedRole === "admin"
  const managedDepartments = useMemo(() => {
    if (adminScope) return adminScope.managedDepartments
    return !isAdminLikeRole && currentUser.department ? [currentUser.department] : []
  }, [adminScope, currentUser.department, isAdminLikeRole])

  // Restrict to managed departments only when the current admin view is truly lead-scoped.
  const isLeadScopedView = Boolean(
    adminScope
      ? adminScope.scopeMode === "lead" || (!adminScope.isAdminLike && adminScope.isDepartmentLead)
      : managedDepartments.length > 0
  )

  const { departments: allDepartments } = useDepartments()
  const departments = isLeadScopedView ? managedDepartments : allDepartments

  const currentOfficeWeek = getCurrentOfficeWeek()
  const [department, setDepartment] = useState(() =>
    report
      ? isLeadScopedView
        ? currentUser.department || report.department
        : report.department
      : isLeadScopedView
        ? currentUser.department || ""
        : ""
  )
  const [week, setWeek] = useState(report?.week_number ?? currentOfficeWeek.week)
  const [year, setYear] = useState(report?.year ?? currentOfficeWeek.year)
  const [saving, setSaving] = useState(false)

  const seed = useWeeklyReportSeed(department, week, year)
  const lock = useWeeklyReportLockState(week, year)

  // Editing an existing report keeps its text; "Add report" mirrors whatever is
  // already filed for the chosen department/week, else tasks synced from the tracker.
  const existing = report ? null : (seed.data?.existing ?? null)
  const selectedExistingReportId = report?.id ?? existing?.id ?? null
  const seeded: ReportTexts = report ? autoNumberReportTexts(report) : seedTexts(seed.data)
  const userId = report?.user_id ?? existing?.user_id ?? currentUser.id
  const status = report?.status || existing?.status || "submitted"

  // Unsaved edits, tied to the selection they were made against — choosing a
  // different department or week must not carry stale text across.
  const selectionKey = report ? "report" : `${department}|${week}|${year}`
  const [draft, setDraft] = useState<{ key: string; texts: ReportTexts } | null>(null)
  const texts = draft && draft.key === selectionKey ? draft.texts : seeded

  const isLockedForExistingReport = Boolean(lock.data?.isLocked && selectedExistingReportId)

  const handleSubmit = async () => {
    const state = await fetchWeeklyReportLockState(createClient(), week, year)
    queryClient.setQueryData(QUERY_KEYS.weeklyReportLockState(week, year), state)
    if (state.isLocked && selectedExistingReportId) {
      toast.error(
        "This report already exists and the grace window has closed. Only missing reports can still be created."
      )
      return
    }

    if (!department || !texts.work_done) {
      toast.error("Required: Department and Work Done")
      return
    }
    setSaving(true)
    try {
      if (isLeadScopedView && report && report.user_id !== currentUser.id) {
        throw new Error("You can only edit reports you created")
      }

      const response = await apiFetch("/api/reports/weekly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedExistingReportId || undefined,
          user_id: isLeadScopedView ? currentUser.id : userId,
          department: isLeadScopedView ? currentUser.department || department : department,
          week_number: week,
          year,
          ...autoNumberReportTexts(texts),
          status,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(payload.error || `Failed to save report (${response.status})`)

      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.weeklyReportSeed(department, week, year) })
      toast.success(report ? "Updated" : "Saved")
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save report")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {report ? "Edit Weekly Report" : "Create Weekly Report"}
          <Sparkles className="h-4 w-4 text-blue-500" />
        </DialogTitle>
        <DialogDescription>
          {report ? "Update this weekly report's details" : "Add a new departmental weekly report"}
        </DialogDescription>
        {isLockedForExistingReport && (
          <p className="text-destructive text-xs">
            Locked after meeting date {lock.data?.meetingDate}. Editing is now closed for existing reports this week.
          </p>
        )}
      </DialogHeader>

      <div className="grid gap-6 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Department</Label>
            <SearchableSelect
              value={department}
              onValueChange={setDepartment}
              options={departments.map((d) => ({ value: d, label: d }))}
              placeholder="Select department"
              disabled={isLeadScopedView}
            />
          </div>
          <div className="space-y-2">
            <Label>Week / Year</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={week}
                onChange={(e) => setWeek((prev) => parseInt(e.target.value) || prev)}
                className="w-1/2"
              />
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear((prev) => parseInt(e.target.value) || prev)}
                className="w-1/2"
              />
            </div>
          </div>
        </div>

        <WeeklyReportTextFields
          values={texts}
          onChange={(field, value) => setDraft({ key: selectionKey, texts: { ...texts, [field]: value } })}
          isNextWeekActive={seed.data?.isNextWeekActive ?? false}
        />
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving || isLockedForExistingReport}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {report ? "Update Report" : "Create Report"}
        </Button>
      </div>
    </>
  )
}
