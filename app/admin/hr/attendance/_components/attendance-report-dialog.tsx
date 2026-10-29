"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmployeeRecipientPicker } from "@/components/admin/employee-recipient-picker"
import { apiFetch, apiJson } from "@/lib/api-client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { LinesSkeleton } from "@/components/skeletons/section-skeletons"

const DEFAULT_SEND_TIMES = ["11:00", "23:00"]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ConfigPayload = {
  recipientUserIds: string[]
  enabled: boolean
  sendTimes: string[]
}

export function AttendanceReportDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: saved, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.attendanceReportConfig(),
    enabled: open,
    queryFn: async (): Promise<ConfigPayload> => {
      const payload = await apiJson<{ data?: ConfigPayload }>("/api/admin/hr/attendance/report-config", {
        cache: "no-store",
      })
      return {
        recipientUserIds: payload.data?.recipientUserIds ?? [],
        enabled: Boolean(payload.data?.enabled),
        sendTimes: payload.data?.sendTimes?.length ? payload.data.sendTimes : DEFAULT_SEND_TIMES,
      }
    },
    meta: { errorMessage: "Failed to load report configuration" },
  })

  // Unsaved edits. Null means "show what the server has".
  const [draft, setDraft] = useState<ConfigPayload | null>(null)
  const form = draft ?? saved ?? { recipientUserIds: [], enabled: false, sendTimes: DEFAULT_SEND_TIMES }
  const { recipientUserIds, enabled, sendTimes } = form
  const edit = (patch: Partial<ConfigPayload>) => setDraft({ ...form, ...patch })
  const setEnabled = (value: boolean) => edit({ enabled: value })
  const setRecipientUserIds = (ids: string[]) => edit({ recipientUserIds: ids })

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraft(null)
    onOpenChange(next)
  }

  const updateSendTime = (index: number, value: string) => {
    edit({ sendTimes: sendTimes.map((t, i) => (i === index ? value : t)) })
  }

  const removeSendTime = (index: number) => {
    edit({ sendTimes: sendTimes.filter((_, i) => i !== index) })
  }

  const addSendTime = () => {
    edit({ sendTimes: [...sendTimes, "12:00"] })
  }

  const save = async () => {
    if (sendTimes.length === 0) {
      toast.error("Add at least one send time")
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/hr/attendance/report-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUserIds, enabled, sendTimes }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error ?? "Failed to save")
      queryClient.setQueryData(QUERY_KEYS.attendanceReportConfig(), form)
      setDraft(null)
      toast.success("Attendance report settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance Reports</DialogTitle>
          <DialogDescription>
            Configure who receives the daily attendance status report — a table of every employee&apos;s status for the
            day plus a summary of counts.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LinesSkeleton lines={6} className="py-8" />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Automatic daily email</p>
                  <p className="text-muted-foreground text-xs">Sends at each time below, every day.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Send times</Label>
                {sendTimes.map((time, index) => (
                  <div key={`row-${index}`} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => updateSendTime(index, e.target.value)}
                      className="w-[140px]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                      onClick={() => removeSendTime(index)}
                      disabled={sendTimes.length === 1}
                      aria-label={`Remove ${time}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addSendTime}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add time
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <EmployeeRecipientPicker selectedIds={recipientUserIds} onChange={setRecipientUserIds} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
