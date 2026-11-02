"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { ORG_ICT_EMAIL } from "@/lib/org-config"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Who hears when the clock-in device stops sending punches. */
export function DeviceAlertDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: saved, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.attendanceDeviceAlertConfig(),
    enabled: open,
    queryFn: async (): Promise<string[]> => {
      const payload = await apiJson<{ data?: { recipientUserIds?: string[] } }>(
        "/api/admin/hr/attendance/device-alert-config",
        { cache: "no-store" }
      )
      return payload.data?.recipientUserIds ?? []
    },
    meta: { errorMessage: "Failed to load device alert recipients" },
  })

  // Unsaved edits. Null means "show what the server has".
  const [draft, setDraft] = useState<string[] | null>(null)
  const recipientUserIds = draft ?? saved ?? []

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraft(null)
    onOpenChange(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/hr/attendance/device-alert-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUserIds }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error ?? "Failed to save")
      queryClient.setQueryData(QUERY_KEYS.attendanceDeviceAlertConfig(), recipientUserIds)
      setDraft(null)
      toast.success("Device alert recipients saved")
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
          <DialogTitle>Device Alerts</DialogTitle>
          <DialogDescription>
            Choose who is emailed and notified in the app when the office clock-in device stops sending punches.{" "}
            {ORG_ICT_EMAIL} is always emailed as well.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LinesSkeleton lines={4} className="py-8" />
        ) : (
          <div className="space-y-2">
            <Label>Recipients</Label>
            <EmployeeRecipientPicker selectedIds={recipientUserIds} onChange={setDraft} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save recipients
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
