"use client"

import { useEffect, useMemo, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

type PolicyRow = {
  notification_key: string
  in_app_enabled: boolean
  email_enabled: boolean
  in_app_mandatory: boolean
  email_mandatory: boolean
  updated_by?: string | null
  updated_at?: string | null
}

const MODULE_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  help_desk: "Help Desk",
  leave: "Leave",
  assets: "Assets",
  meetings: "Meetings",
  communications: "Communications",
  reports: "Reports",
  system: "System",
}

export function MailPolicySettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policies, setPolicies] = useState<PolicyRow[]>([])

  useEffect(() => {
    void loadPolicies()
  }, [])

  async function loadPolicies() {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/settings/mail", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Failed to load mail policies")
      setPolicies(
        Array.isArray(payload.policies)
          ? payload.policies.map((row: Partial<PolicyRow> & { notification_key: string }) => ({
              ...row,
              in_app_enabled: row.in_app_enabled !== false,
              email_enabled: row.email_enabled !== false,
              in_app_mandatory: row.in_app_mandatory === true,
              email_mandatory: row.email_mandatory === true,
            }))
          : []
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load mail policies"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  function updatePolicy(
    key: string,
    field: "in_app_enabled" | "email_enabled" | "in_app_mandatory" | "email_mandatory",
    value: boolean
  ) {
    setPolicies((prev) =>
      prev.map((row) => {
        if (row.notification_key !== key) return row
        const next = { ...row, [field]: value }

        if (field === "in_app_enabled" && value === false) {
          next.in_app_mandatory = false
        }
        if (field === "email_enabled" && value === false) {
          next.email_mandatory = false
        }
        if (field === "in_app_mandatory" && value === true) {
          next.in_app_enabled = true
        }
        if (field === "email_mandatory" && value === true) {
          next.email_enabled = true
        }
        return next
      })
    )
  }

  async function savePolicies() {
    setSaving(true)
    try {
      const response = await fetch("/api/admin/settings/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policies }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Failed to save mail policies")

      toast.success("Mail policies updated")
      await loadPolicies()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save mail policies"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const rows = useMemo(
    () =>
      [...policies].sort((a, b) => {
        const la = MODULE_LABELS[a.notification_key] || a.notification_key
        const lb = MODULE_LABELS[b.notification_key] || b.notification_key
        return la.localeCompare(lb)
      }),
    [policies]
  )

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading mail policies...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={savePolicies} disabled={saving}>
          {saving ? "Saving..." : "Save Mail Policies"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="text-muted-foreground grid grid-cols-10 border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
            <div className="col-span-2">Notification Module</div>
            <div className="col-span-2 text-center">In-App</div>
            <div className="col-span-3 text-center">In-App Mandatory</div>
            <div className="col-span-1 text-center">Email</div>
            <div className="col-span-2 text-center">Email Mandatory</div>
          </div>

          {rows.map((row) => (
            <div
              key={row.notification_key}
              className="grid grid-cols-10 items-center border-b px-4 py-3 last:border-b-0"
            >
              <div className="col-span-2 text-sm font-medium">
                {MODULE_LABELS[row.notification_key] || row.notification_key}
              </div>
              <div className="col-span-2 flex justify-center">
                <Switch
                  checked={row.in_app_enabled}
                  onCheckedChange={(checked) => updatePolicy(row.notification_key, "in_app_enabled", checked)}
                />
              </div>
              <div className="col-span-3 flex justify-center">
                <Switch
                  checked={row.in_app_mandatory}
                  disabled={!row.in_app_enabled}
                  onCheckedChange={(checked) => updatePolicy(row.notification_key, "in_app_mandatory", checked)}
                />
              </div>
              <div className="col-span-1 flex justify-center">
                <Switch
                  checked={row.email_enabled}
                  onCheckedChange={(checked) => updatePolicy(row.notification_key, "email_enabled", checked)}
                />
              </div>
              <div className="col-span-2 flex justify-center">
                <Switch
                  checked={row.email_mandatory}
                  disabled={!row.email_enabled}
                  onCheckedChange={(checked) => updatePolicy(row.notification_key, "email_mandatory", checked)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
