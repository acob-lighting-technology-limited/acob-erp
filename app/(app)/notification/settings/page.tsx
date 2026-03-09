"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Bell } from "lucide-react"
import { toast } from "sonner"

type ModuleSetting = {
  notification_key: string
  system_in_app_enabled: boolean
  system_email_enabled: boolean
  system_in_app_mandatory: boolean
  system_email_mandatory: boolean
  user_in_app_enabled: boolean | null
  user_email_enabled: boolean | null
  effective_in_app_enabled: boolean
  effective_email_enabled: boolean
}

type NotificationSettingsResponse = {
  global: {
    in_app_enabled: boolean
    email_enabled: boolean
    email_frequency: "immediate" | "hourly" | "daily" | "weekly" | "never"
    quiet_hours_start: string | null
    quiet_hours_end: string | null
  }
  modules: ModuleSetting[]
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

export default function NotificationSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [globalInApp, setGlobalInApp] = useState(true)
  const [globalEmail, setGlobalEmail] = useState(true)
  const [modules, setModules] = useState<ModuleSetting[]>([])

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const response = await fetch("/api/settings/notifications", { cache: "no-store" })
      const payload = (await response.json()) as NotificationSettingsResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Failed to load notification settings")

      setGlobalInApp(payload.global.in_app_enabled)
      setGlobalEmail(payload.global.email_enabled)
      setModules(
        Array.isArray(payload.modules)
          ? payload.modules.map((module) => ({
              ...module,
              system_in_app_enabled: module.system_in_app_enabled !== false,
              system_email_enabled: module.system_email_enabled !== false,
              system_in_app_mandatory: module.system_in_app_mandatory === true,
              system_email_mandatory: module.system_email_mandatory === true,
            }))
          : []
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load notification settings"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  function updateModule(key: string, field: "user_in_app_enabled" | "user_email_enabled", value: boolean) {
    setModules((prev) =>
      prev.map((module) => {
        if (module.notification_key !== key) return module
        return { ...module, [field]: value }
      })
    )
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          global: {
            in_app_enabled: globalInApp,
            email_enabled: globalEmail,
          },
          modules: modules.map((module) => ({
            notification_key: module.notification_key,
            in_app_enabled: module.user_in_app_enabled,
            email_enabled: module.user_email_enabled,
          })),
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "Failed to save notification settings")

      toast.success("Notification preferences saved")
      await loadSettings()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save notification settings"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const sortedModules = useMemo(
    () =>
      [...modules].sort((a, b) => {
        const la = MODULE_LABELS[a.notification_key] || a.notification_key
        const lb = MODULE_LABELS[b.notification_key] || b.notification_key
        return la.localeCompare(lb)
      }),
    [modules]
  )

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Notification Settings"
        description="Control your in-app and email notification preferences."
        icon={Bell}
        backLink={{ href: "/notification", label: "Back to Notifications" }}
        actions={
          <Button onClick={saveSettings} disabled={loading || saving}>
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Global Preferences</CardTitle>
            <CardDescription>
              Quickly enable or disable most in-app/email notifications for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">In-App Notifications</p>
                <p className="text-muted-foreground text-sm">Show alerts inside ERP.</p>
              </div>
              <Switch checked={globalInApp} onCheckedChange={setGlobalInApp} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-muted-foreground text-sm">Send notifications to your email inbox.</p>
              </div>
              <Switch checked={globalEmail} onCheckedChange={setGlobalEmail} />
            </div>
            <p className="text-muted-foreground text-xs">
              Mandatory channels from admin policy are always delivered while system delivery for that channel is
              enabled.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per-Module Preferences</CardTitle>
            <CardDescription>
              Choose which modules can notify you. System-level admin locks still apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-muted-foreground grid grid-cols-12 border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
              <div className="col-span-6">Module</div>
              <div className="col-span-3 text-center">In-App</div>
              <div className="col-span-3 text-center">Email</div>
            </div>
            {sortedModules.map((module) => (
              <div
                key={module.notification_key}
                className="grid grid-cols-12 items-center border-b px-4 py-3 last:border-b-0"
              >
                <div className="col-span-6">
                  <p className="text-sm font-medium">
                    {MODULE_LABELS[module.notification_key] || module.notification_key}
                  </p>
                  {(!module.system_in_app_enabled ||
                    !module.system_email_enabled ||
                    module.system_in_app_mandatory ||
                    module.system_email_mandatory) && (
                    <p className="text-muted-foreground text-xs">Some channels are locked by admin policy.</p>
                  )}
                </div>
                <div className="col-span-3 flex justify-center">
                  <Switch
                    checked={module.system_in_app_mandatory ? true : module.user_in_app_enabled !== false}
                    disabled={!module.system_in_app_enabled || module.system_in_app_mandatory}
                    onCheckedChange={(checked) => updateModule(module.notification_key, "user_in_app_enabled", checked)}
                  />
                </div>
                <div className="col-span-3 flex justify-center">
                  <Switch
                    checked={module.system_email_mandatory ? true : module.user_email_enabled !== false}
                    disabled={!module.system_email_enabled || module.system_email_mandatory}
                    onCheckedChange={(checked) => updateModule(module.notification_key, "user_email_enabled", checked)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
