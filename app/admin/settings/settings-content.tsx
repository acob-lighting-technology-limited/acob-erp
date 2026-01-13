"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, Power, Wrench, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { SystemSettings } from "./page"

interface SettingsContentProps {
  initialSettings: SystemSettings
}

export function SettingsContent({ initialSettings }: SettingsContentProps) {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SystemSettings>(initialSettings)

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/system-settings")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      toast.error("Failed to load settings")
    }
  }

  const updateSetting = async (settingKey: string, settingValue: any) => {
    setSaving(true)
    try {
      const response = await fetch("/api/system-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settingKey, settingValue }),
      })

      if (response.ok) {
        toast.success("Settings updated successfully")
        await fetchSettings()
      } else {
        const data = await response.json()
        throw new Error(data.error || "Failed to update settings")
      }
    } catch (error: any) {
      console.error("Error updating settings:", error)
      toast.error(error.message || "Failed to update settings")
    } finally {
      setSaving(false)
    }
  }

  const handleShutdownToggle = async (enabled: boolean) => {
    const newSettings = {
      enabled,
      title: settings.shutdown_mode?.title || "Service Discontinued",
      message: settings.shutdown_mode?.message || "This service has been discontinued.",
    }
    setSettings({ ...settings, shutdown_mode: newSettings })
    await updateSetting("shutdown_mode", newSettings)
  }

  const handleMaintenanceToggle = async (enabled: boolean) => {
    const newSettings = {
      enabled,
      title: settings.maintenance_mode?.title || "Maintenance Mode",
      message: settings.maintenance_mode?.message || "We are currently performing scheduled maintenance.",
      estimated_end: settings.maintenance_mode?.estimated_end || null,
    }
    setSettings({ ...settings, maintenance_mode: newSettings })
    await updateSetting("maintenance_mode", newSettings)
  }

  const handleShutdownSave = async () => {
    await updateSetting("shutdown_mode", settings.shutdown_mode)
  }

  const handleMaintenanceSave = async () => {
    await updateSetting("maintenance_mode", settings.maintenance_mode)
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-foreground text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground mt-1">Manage system-wide settings and modes</p>
        </div>

        {/* Warning Banner */}
        {(settings.shutdown_mode?.enabled || settings.maintenance_mode?.enabled) && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-200">System Access Restricted</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  {settings.shutdown_mode?.enabled && "Shutdown mode is active. "}
                  {settings.maintenance_mode?.enabled && "Maintenance mode is active. "}
                  Regular users cannot access the application.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shutdown Mode */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                  <Power className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle>Shutdown Mode</CardTitle>
                  <CardDescription>Completely disable the application for all users</CardDescription>
                </div>
              </div>
              <Switch
                checked={settings.shutdown_mode?.enabled || false}
                onCheckedChange={handleShutdownToggle}
                disabled={saving}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shutdown-title">Title</Label>
              <Input
                id="shutdown-title"
                value={settings.shutdown_mode?.title || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    shutdown_mode: {
                      ...settings.shutdown_mode!,
                      title: e.target.value,
                    },
                  })
                }
                placeholder="Service Discontinued"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shutdown-message">Message</Label>
              <Textarea
                id="shutdown-message"
                value={settings.shutdown_mode?.message || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    shutdown_mode: {
                      ...settings.shutdown_mode!,
                      message: e.target.value,
                    },
                  })
                }
                placeholder="This service has been discontinued..."
                rows={4}
              />
            </div>
            <Button onClick={handleShutdownSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Shutdown Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Maintenance Mode */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                  <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle>Maintenance Mode</CardTitle>
                  <CardDescription>Temporarily disable the application for maintenance</CardDescription>
                </div>
              </div>
              <Switch
                checked={settings.maintenance_mode?.enabled || false}
                onCheckedChange={handleMaintenanceToggle}
                disabled={saving}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maintenance-title">Title</Label>
              <Input
                id="maintenance-title"
                value={settings.maintenance_mode?.title || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maintenance_mode: {
                      ...settings.maintenance_mode!,
                      title: e.target.value,
                    },
                  })
                }
                placeholder="Maintenance Mode"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Message</Label>
              <Textarea
                id="maintenance-message"
                value={settings.maintenance_mode?.message || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maintenance_mode: {
                      ...settings.maintenance_mode!,
                      message: e.target.value,
                    },
                  })
                }
                placeholder="We are currently performing scheduled maintenance..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-end">Estimated End Time (Optional)</Label>
              <Input
                id="maintenance-end"
                type="datetime-local"
                value={settings.maintenance_mode?.estimated_end || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maintenance_mode: {
                      ...settings.maintenance_mode!,
                      estimated_end: e.target.value || null,
                    },
                  })
                }
              />
            </div>
            <Button onClick={handleMaintenanceSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Maintenance Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-blue-900 dark:text-blue-200">Important Information</p>
                <ul className="list-inside list-disc space-y-1 text-blue-800 dark:text-blue-300">
                  <li>Shutdown mode takes priority over maintenance mode</li>
                  <li>Super admins can always access the system using the bypass password</li>
                  <li>Click the logo 4 times on the shutdown/maintenance page to reveal the admin login</li>
                  <li>Changes take effect immediately for all users</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
