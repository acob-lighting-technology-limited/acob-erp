"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarClock, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { EmployeeRecipientPicker } from "@/components/admin/employee-recipient-picker"
import { RowsSkeleton } from "@/components/skeletons/section-skeletons"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ReminderConfig {
  enabled: boolean
  recipientUserIds: string[]
  externalEmails: string[]
  lastSentWeek: string | null
}

/**
 * Who gets the Monday email listing the week's birthdays, and whether it goes
 * out. Opened from the Birthday Manager; sent by /api/cron/hr/birthday-reminder.
 */
export function BirthdayReminderDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [externalEmails, setExternalEmails] = useState<string[]>([])
  const [enabled, setEnabled] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.adminHrBirthdayReminder(),
    enabled: open,
    queryFn: async (): Promise<ReminderConfig> => {
      const res = await apiFetch("/api/admin/hr/birthdays/reminder", { cache: "no-store" })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || "Failed to load the birthday reminder")
      return payload.data
    },
  })

  // Load the saved config into the form each time the dialog opens with fresh data
  // (adjusted during render rather than in an effect).
  const [loadedFrom, setLoadedFrom] = useState<ReminderConfig | null>(null)
  if (open && data && loadedFrom !== data) {
    setLoadedFrom(data)
    setSelectedEmployeeIds(data.recipientUserIds)
    setExternalEmails(data.externalEmails)
    setEnabled(data.enabled)
  }
  if (!open && loadedFrom) setLoadedFrom(null)

  const recipientCount = selectedEmployeeIds.length + externalEmails.length

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/admin/hr/birthdays/reminder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, recipientUserIds: selectedEmployeeIds, externalEmails }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || "Failed to save the birthday reminder")
    },
    onSuccess: () => {
      toast.success("Birthday reminder saved")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminHrBirthdayReminder() })
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save the birthday reminder")
    },
  })

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Weekly Birthday Reminder"
      description="Choose who gets an email every Monday at 12:00 AM listing that week's birthdays."
    >
      {isLoading ? (
        <RowsSkeleton rows={4} className="py-4" />
      ) : error ? (
        <div className="text-destructive py-6 text-center text-sm">
          {error instanceof Error ? error.message : "Failed to load the birthday reminder"}
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-sm font-semibold">Every Monday, 12:00 AM</p>
                <p className="text-muted-foreground text-xs">Birthdays from Monday to Sunday of that week</p>
              </div>
            </div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              <span>
                {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Send the reminder automatically</p>
              <p className="text-muted-foreground text-xs">No email goes out in a week with no birthdays.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Send the reminder automatically" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Recipients</Label>
              <span className="text-muted-foreground text-xs">{recipientCount} selected</span>
            </div>
            <EmployeeRecipientPicker
              selectedIds={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
              extraBadges={externalEmails.map((email) => ({
                key: email,
                label: email,
                onRemove: () => setExternalEmails((prev) => prev.filter((e) => e !== email)),
              }))}
              emptyHint="No recipients selected — nobody will get the reminder."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveModal>
  )
}
