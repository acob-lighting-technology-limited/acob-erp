"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { BellRing, Share, SquarePlus } from "lucide-react"
import {
  getExistingSubscription,
  getPushSupport,
  isIos,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupportState,
} from "@/lib/push/client"

interface PushNotificationToggleProps {
  vapidPublicKey: string
}

export function PushNotificationToggle({ vapidPublicKey }: PushNotificationToggleProps) {
  const [support, setSupport] = useState<PushSupportState | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Support depends on browser APIs, so it can only be resolved on the client.
    setSupport(getPushSupport())
    getExistingSubscription()
      .then((subscription) => setIsSubscribed(Boolean(subscription)))
      .catch(() => setIsSubscribed(false))
  }, [])

  const handleToggle = async (next: boolean) => {
    setIsLoading(true)
    try {
      if (next) {
        await subscribeToPush(vapidPublicKey)
        setIsSubscribed(true)
        toast.success("Push notifications enabled on this device.")
      } else {
        await unsubscribeFromPush()
        setIsSubscribed(false)
        toast.success("Push notifications disabled on this device.")
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update push notifications.")
    } finally {
      setIsLoading(false)
    }
  }

  // Render nothing until support is known, so the control never flashes the
  // wrong state on first paint.
  if (support === null) return null

  if (!vapidPublicKey) {
    return (
      <div className="bg-muted/30 flex items-start gap-3 rounded-lg border p-4">
        <BellRing className="text-muted-foreground mt-0.5 h-5 w-5" />
        <div className="space-y-1">
          <Label className="text-base font-semibold">Push Notifications</Label>
          <p className="text-muted-foreground text-sm">Push notifications are not configured on this server yet.</p>
        </div>
      </div>
    )
  }

  // The iOS dead end: Safari hides the push APIs entirely until the app is
  // installed, so this explains the fix instead of saying "unsupported".
  if (support === "requires-install") {
    return (
      <div className="bg-muted/30 space-y-3 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <BellRing className="text-muted-foreground mt-0.5 h-5 w-5" />
          <div className="space-y-1">
            <Label className="text-base font-semibold">Push Notifications</Label>
            <p className="text-muted-foreground text-sm">
              To get alerts on your iPhone, add Matrix to your Home Screen first. iOS only allows notifications from
              installed apps.
            </p>
          </div>
        </div>
        <ol className="text-muted-foreground ml-8 list-decimal space-y-1 text-sm">
          <li className="flex items-center gap-1.5">
            <span>Open Matrix in Safari, then tap Share</span>
            <Share className="inline h-3.5 w-3.5" aria-hidden />
          </li>
          <li className="flex items-center gap-1.5">
            <span>Tap &ldquo;Add to Home Screen&rdquo;</span>
            <SquarePlus className="inline h-3.5 w-3.5" aria-hidden />
          </li>
          <li>Open Matrix from your Home Screen, then return here to enable</li>
        </ol>
      </div>
    )
  }

  if (support === "unsupported") {
    return (
      <div className="bg-muted/30 flex items-start gap-3 rounded-lg border p-4">
        <BellRing className="text-muted-foreground mt-0.5 h-5 w-5" />
        <div className="space-y-1">
          <Label className="text-base font-semibold">Push Notifications</Label>
          <p className="text-muted-foreground text-sm">
            This device or browser doesn&rsquo;t support push notifications
            {isIos() ? " (iOS 16.4 or later is required)" : ""}. You&rsquo;ll still receive email and in-app alerts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between space-x-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <BellRing className="text-muted-foreground mt-0.5 h-5 w-5" />
        <div className="space-y-1">
          <Label htmlFor="push-notifs" className="text-base font-semibold">
            Push Notifications
          </Label>
          <p className="text-muted-foreground text-sm">
            Get alerts on this device even when Matrix is closed. Enable this on each device you use.
          </p>
        </div>
      </div>
      {/* A Switch is a user gesture, which browsers require before the
          permission prompt can be raised. */}
      <Switch
        id="push-notifs"
        checked={isSubscribed}
        disabled={isLoading}
        onCheckedChange={handleToggle}
        aria-label="Enable push notifications on this device"
      />
    </div>
  )
}
