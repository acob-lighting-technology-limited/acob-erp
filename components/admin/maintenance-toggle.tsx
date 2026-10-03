"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { apiFetch, apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

const log = logger("admin-maintenance-toggle")

type MaintenanceState = { can_toggle?: boolean; data?: { enabled?: boolean } }

export function MaintenanceToggle() {
  const queryClient = useQueryClient()
  const [updating, setUpdating] = useState(false)

  const { data, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.maintenanceState(),
    queryFn: () => apiJson<MaintenanceState>("/api/dev/maintenance", { cache: "no-store" }),
    meta: { errorMessage: "Failed to load maintenance settings" },
  })
  const canToggle = Boolean(data?.can_toggle)
  const enabled = Boolean(data?.data?.enabled)
  const setEnabled = (next: boolean) =>
    queryClient.setQueryData<MaintenanceState>(QUERY_KEYS.maintenanceState(), (prev) => ({
      ...prev,
      data: { ...prev?.data, enabled: next },
    }))

  async function handleToggle(checked: boolean) {
    // Prevent overlapping requests
    if (updating) return

    setUpdating(true)
    try {
      if (!canToggle) {
        toast.error("Only super admin or developer can change maintenance mode")
        return
      }

      const response = await apiFetch("/api/dev/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: checked,
          message: "System is under maintenance. Please check back later.",
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Failed to update maintenance mode")

      setEnabled(Boolean(payload.data?.enabled))
      toast.success(payload.message || (checked ? "Maintenance mode enabled" : "Maintenance mode disabled"))
    } catch (error) {
      log.error("Error toggling maintenance mode:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update maintenance mode")
      // Revert state
      setEnabled(!checked)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex items-center justify-between space-x-2">
      <div className="space-y-0.5">
        <Label htmlFor="maintenance-mode" className="text-base font-medium">
          Maintenance Mode
        </Label>
        <p className="text-muted-foreground text-sm">
          {enabled
            ? "System is currently locked. Only super admin and developer can access."
            : "System is active and accessible to all users."}
        </p>
      </div>
      <Switch
        id="maintenance-mode"
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={loading || updating || !canToggle}
      />
    </div>
  )
}
