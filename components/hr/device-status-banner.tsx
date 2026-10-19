"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { WifiOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDateTime } from "@/lib/utils/date"

interface DeviceStatus {
  offline: "morning" | "evening" | null
  lastPunchAt: string | null
  outageStartDate: string | null
}

/**
 * Whether the clock-in device is delivering punches. Staff who see a blank
 * clock-in or clock-out otherwise assume it was never recorded and appeal; the
 * device actually keeps every punch and sends the backlog when it reconnects.
 */
function useDeviceStatus() {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.attendanceDeviceStatus(),
    queryFn: () => apiJson<{ data: DeviceStatus }>("/api/hr/attendance/device-status").then((res) => res.data),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })
  return data?.offline ? data : null
}

/** Inline notice for the admin attendance page while the device is offline. */
export function DeviceStatusBanner() {
  const status = useDeviceStatus()
  if (!status) return null

  const since = status.lastPunchAt ? formatWATDateTime(status.lastPunchAt) : null
  return (
    <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
      <WifiOff className="h-4 w-4 text-amber-600" />
      <AlertTitle>The clock-in device has lost connection</AlertTitle>
      <AlertDescription>
        <p>
          {since ? `No punches received since ${since}. ` : "No punches received today. "}
          Missing clock-ins and clock-outs from then on are the device&apos;s backlog, not absences. Staff appeals for
          those days are paused until it reconnects.
        </p>
      </AlertDescription>
    </Alert>
  )
}

const DISMISSED_KEY = "attendance-device-offline-dismissed"

function readDismissed(): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/**
 * Pop-up for staff on /hr/attendance while the device is offline. Once closed it
 * stays closed for that outage in this tab; a new outage shows it again.
 */
export function DeviceStatusDialog() {
  const status = useDeviceStatus()
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)

  if (!status) return null
  const outageKey = status.lastPunchAt ?? status.outageStartDate ?? "unknown"
  if (dismissed === outageKey) return null

  const close = () => {
    setDismissed(outageKey)
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, outageKey)
    } catch {
      // Storage blocked (private mode): it simply shows again on the next visit.
    }
  }

  const since = status.lastPunchAt ? formatWATDateTime(status.lastPunchAt) : null
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-amber-600" />
            The clock-in device has lost connection
          </DialogTitle>
          <DialogDescription>
            {since ? `No records have come through since ${since}. ` : "No records have come through today. "}
            If you clocked in or out, it is saved on the device and will show here once it reconnects. You don&apos;t
            need to appeal; please hold on while it is resolved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={close}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
