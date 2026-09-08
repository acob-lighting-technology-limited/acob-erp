"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Bell, Mail, ShieldAlert } from "lucide-react"
import { PushNotificationToggle } from "@/components/push-notification-toggle"

interface NotificationPreferencesFormProps {
  userId: string
  initialEmailNotifications: boolean
  vapidPublicKey: string
}

export function NotificationPreferencesForm({
  userId,
  initialEmailNotifications,
  vapidPublicKey,
}: NotificationPreferencesFormProps) {
  const [emailNotifications, setEmailNotifications] = useState(initialEmailNotifications)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)

    try {
      // Upsert, because most users have never had a preferences row: the
      // delivery gate defaults a missing row to "allowed", so opting out has
      // to create the row rather than update a row that isn't there.
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: userId,
          email_enabled: emailNotifications,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

      if (error) throw error

      toast.success("Notification preferences updated!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update notification preferences"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Notification Preferences</CardTitle>
            <CardDescription className="text-sm">
              Manage how and when you receive system alerts and email updates
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between space-x-4 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <Mail className="text-muted-foreground mt-0.5 h-5 w-5" />
                <div className="space-y-1">
                  <Label htmlFor="email-notifs" className="text-base font-semibold">
                    Email Notifications
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Receive email digests and alerts for task assignments, approvals, and system updates.
                  </p>
                </div>
              </div>
              <Switch id="email-notifs" checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>

            {/* Device-scoped, so it saves immediately rather than on submit:
                the browser permission grant belongs to this device, not to the
                account-level preferences saved below. */}
            <PushNotificationToggle vapidPublicKey={vapidPublicKey} />

            <div className="bg-muted/30 flex items-start justify-between space-x-4 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="text-muted-foreground mt-0.5 h-5 w-5" />
                <div className="space-y-1">
                  <Label className="text-base font-semibold">In-App Notifications</Label>
                  <p className="text-muted-foreground text-sm">
                    In-app notification bell alerts are always enabled for critical approvals and workflow updates.
                  </p>
                </div>
              </div>
              <Switch checked disabled aria-label="In-app notifications always enabled" />
            </div>
          </div>

          <Button type="submit" loading={isLoading}>
            Save Preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
