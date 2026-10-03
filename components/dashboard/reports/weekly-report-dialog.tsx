"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, Sparkles } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import { createClient } from "@/lib/supabase/client"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { autoNumberReportTexts, type ReportTexts } from "@/lib/reports/weekly-report-text"
import { WeeklyReportTextFields } from "@/components/reports/weekly-report-text-fields"
import { useMyProfile } from "@/hooks/use-my-profile"
import { useWeeklyReportLockState } from "@/hooks/use-weekly-report-lock"
import { seedTexts, useWeeklyReportSeed } from "@/hooks/use-weekly-report-seed"

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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {/* Mounted only while open, so every open starts from the server's current state. */}
        {isOpen ? <WeeklyReportForm onClose={onClose} onSuccess={onSuccess} initialData={initialData} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function WeeklyReportForm({ onClose, onSuccess, initialData }: Omit<WeeklyReportDialogProps, "isOpen">) {
  const queryClient = useQueryClient()
  const currentOfficeWeek = getCurrentOfficeWeek()
  const week = initialData?.week || currentOfficeWeek.week
  const year = initialData?.year || currentOfficeWeek.year

  const profile = useMyProfile()
  const department = initialData?.dept || profile.data?.department || ""

  const seed = useWeeklyReportSeed(department, week, year)
  const lock = useWeeklyReportLockState(week, year)
  const [draft, setDraft] = useState<ReportTexts | null>(null)
  const [saving, setSaving] = useState(false)

  const loading = profile.isLoading || seed.isLoading
  const texts = draft ?? seedTexts(seed.data)
  const id = seed.data?.existing?.id ?? null
  const isNextWeekActive = seed.data?.isNextWeekActive ?? false
  // Once the grace window has closed the week is read-only — block typing outright
  // instead of letting the user fill the form and fail at submit. Also treat the
  // unresolved state as locked so there is no editable gap while the RPC is in flight.
  const isWeekLocked = !lock.data || lock.data.isLocked

  const handleSubmit = async () => {
    const state = await fetchWeeklyReportLockState(createClient(), week, year)
    queryClient.setQueryData(QUERY_KEYS.weeklyReportLockState(week, year), state)
    if (state.isLocked) {
      toast.error("This report week is locked. Contact admin for a temporary unlock.")
      return
    }

    if (!texts.work_done.trim()) {
      toast.error("Please describe work done")
      return
    }
    setSaving(true)
    try {
      const response = await apiFetch("/api/reports/weekly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id || undefined,
          department,
          week_number: week,
          year,
          ...autoNumberReportTexts(texts),
          status: "submitted",
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || `Failed to submit report (${response.status})`)
      }
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.weeklyReportSeed(department, week, year) })
      toast.success("Success")
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit report")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {id ? "Edit Weekly Report" : "Submit Weekly Report"}
          <Sparkles className="text-primary h-4 w-4" />
        </DialogTitle>
        <DialogDescription>
          Progress update for <span className="text-primary font-semibold">{department}</span> — Week {week}, {year}
        </DialogDescription>
        {lock.data?.isLocked && (
          <p className="text-destructive text-xs">
            Locked after meeting date {lock.data.meetingDate}. This week is read-only — contact an admin for a temporary
            unlock.
          </p>
        )}
      </DialogHeader>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 py-4">
          <WeeklyReportTextFields
            values={texts}
            onChange={(field, value) => setDraft({ ...texts, [field]: value })}
            readOnly={isWeekLocked}
            isNextWeekActive={isNextWeekActive}
            nextWeekActiveNote="Locked: Next week's tracker is already active."
          />
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving || loading || isWeekLocked}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {id ? "Update Report" : "Submit Report"}
        </Button>
      </div>
    </>
  )
}
