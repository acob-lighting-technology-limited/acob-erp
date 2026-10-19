"use client"

import { useQuery } from "@tanstack/react-query"
import { WifiOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDateTime } from "@/lib/utils/date"

interface DeviceStatus {
  offline: "morning" | "evening" | null
  lastPunchAt: string | null
  outageStartDate: string | null
}

/**
 * Shown on the attendance pages while the clock-in device is not delivering
 * punches. Staff who see a blank clock-in or clock-out otherwise assume it was
 * never recorded and appeal; the device actually keeps every punch and sends
 * the backlog when it reconnects. Disappears on its own once punches arrive.
 */
export function DeviceStatusBanner({ audience = "staff" }: { audience?: "staff" | "admin" }) {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.attendanceDeviceStatus(),
    queryFn: () => apiJson<{ data: DeviceStatus }>("/api/hr/attendance/device-status").then((res) => res.data),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })

  if (!data?.offline) return null

  const since = data.lastPunchAt ? formatWATDateTime(data.lastPunchAt) : null
  return (
    <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
      <WifiOff className="h-4 w-4 text-amber-600" />
      <AlertTitle>The clock-in device has lost connection</AlertTitle>
      <AlertDescription>
        {audience === "staff" ? (
          <p>
            {since ? `No records have come through since ${since}. ` : "No records have come through today. "}
            If you clocked in or out, it is saved on the device and will show here once it reconnects. You don&apos;t
            need to appeal; please hold on while it is resolved.
          </p>
        ) : (
          <p>
            {since ? `No punches received since ${since}. ` : "No punches received today. "}
            Missing clock-ins and clock-outs from then on are the device&apos;s backlog, not absences. Staff appeals for
            those days are paused until it reconnects.
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
