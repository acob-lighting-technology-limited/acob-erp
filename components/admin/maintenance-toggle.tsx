"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"

export function MaintenanceToggle() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single()

      if (error) {
        if (error.code !== "PGRST116") {
          // Not found is ok
          console.error("Error loading maintenance settings:", error)
        }
      } else if (data?.value) {
        setEnabled(data.value.enabled)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(checked: boolean) {
    const supabase = createClient()
    const newValue = {
      enabled: checked,
      message: "System is under maintenance. Please check back later.",
    }

    const { error } = await supabase.from("system_settings").upsert({
      key: "maintenance_mode",
      value: newValue,
    })

    if (error) {
      toast.error("Failed to update maintenance mode")
      console.error(error)
      // Revert state
      setEnabled(!checked)
    } else {
      setEnabled(checked)
      toast.success(checked ? "Maintenance mode enabled" : "Maintenance mode disabled")
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
            ? "System is currently locked. Only admins can access."
            : "System is active and accessible to all users."}
        </p>
      </div>
      <Switch id="maintenance-mode" checked={enabled} onCheckedChange={handleToggle} disabled={loading} />
    </div>
  )
}
