"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { EmployeeRecipientPicker } from "@/components/admin/employee-recipient-picker"
import { apiFetch } from "@/lib/api-client"
import { depsChanged } from "@/lib/utils/deps-changed"
import { DEFAULT_STARLINK_ALERTS, type StarlinkAlertsConfig } from "@/lib/starlink/billing-alerts"

/** Choose who is emailed (and notified in the Matrix) when a Starlink payment fails or a bill is coming due. */
export function StarlinkAlertsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [config, setConfig] = useState<StarlinkAlertsConfig>(DEFAULT_STARLINK_ALERTS)
  const [saving, setSaving] = useState(false)
  const [seeded, setSeeded] = useState<readonly unknown[] | null>(null)

  // Fetched each time the dialog opens; retry off so a failure is reported once.
  const alertsQuery = useQuery({
    queryKey: ["starlink-alerts-config"],
    queryFn: async (): Promise<StarlinkAlertsConfig> => {
      const res = await apiFetch("/api/starlink/alerts", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load alert settings")
      return json.data as StarlinkAlertsConfig
    },
    enabled: open,
    retry: false,
  })
  const loading = alertsQuery.isFetching

  useEffect(() => {
    if (alertsQuery.error) {
      toast.error(alertsQuery.error instanceof Error ? alertsQuery.error.message : "Failed to load alert settings")
    }
  }, [alertsQuery.error])

  // Each open (and each fresh fetch) starts the draft from the saved settings, during render rather than in an effect.
  const seedNext = [open, alertsQuery.dataUpdatedAt] as const
  if (depsChanged(seeded, seedNext)) {
    setSeeded(seedNext)
    if (alertsQuery.data) setConfig(alertsQuery.data)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch("/api/starlink/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to save")
      toast.success("Starlink alert settings saved")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Starlink Alerts</DialogTitle>
          <DialogDescription>
            Choose who is told when a kit&apos;s payment fails or its bill is coming due. Each person gets an email and
            a Matrix notification.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Loading…</div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Payment failed</p>
                    <p className="text-muted-foreground text-xs">
                      Sent within the hour when Starlink can&apos;t charge a kit&apos;s card. Once per bill, however
                      many retries fail.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.failed.enabled}
                  onCheckedChange={(enabled) => setConfig((c) => ({ ...c, failed: { ...c.failed, enabled } }))}
                  aria-label="Send payment failed alerts"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Recipients</Label>
                <EmployeeRecipientPicker
                  selectedIds={config.failed.recipientUserIds}
                  onChange={(recipientUserIds) =>
                    setConfig((c) => ({ ...c, failed: { ...c.failed, recipientUserIds } }))
                  }
                />
              </div>
            </section>

            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-2.5">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Bill coming due</p>
                    <p className="text-muted-foreground text-xs">
                      A reminder before each kit&apos;s autopay date, so the card can be funded in time. Sent in working
                      hours (8am–6pm).
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.due.enabled}
                  onCheckedChange={(enabled) => setConfig((c) => ({ ...c, due: { ...c.due, enabled } }))}
                  aria-label="Send bill due alerts"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="due-days" className="text-xs">
                  Days before
                </Label>
                <Input
                  id="due-days"
                  type="number"
                  min={0}
                  max={14}
                  value={config.due.daysBefore}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      due: { ...c.due, daysBefore: Math.max(0, Math.min(14, Number(e.target.value) || 0)) },
                    }))
                  }
                  className="w-20"
                />
                <span className="text-muted-foreground text-xs">0 = on the day</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Recipients</Label>
                <EmployeeRecipientPicker
                  selectedIds={config.due.recipientUserIds}
                  onChange={(recipientUserIds) => setConfig((c) => ({ ...c, due: { ...c.due, recipientUserIds } }))}
                />
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={loading}>
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
