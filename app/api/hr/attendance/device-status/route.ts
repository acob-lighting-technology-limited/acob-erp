import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/supabase/admin"
import { deviceOutageStartDate, getDeviceHealth } from "@/lib/hr/device-health"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/hr/attendance/device-status")
export const dynamic = "force-dynamic"

/**
 * Whether the clock-in device is currently delivering punches, for the banner
 * on the attendance pages. Any signed-in user may ask; the answer carries only
 * aggregate state, never who punched.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const service = getServiceClient()
    if (!service) return NextResponse.json({ data: { offline: null, lastPunchAt: null, outageStartDate: null } })

    const health = await getDeviceHealth(service)
    return NextResponse.json({
      data: {
        offline: health.offline,
        lastPunchAt: health.lastPunchAt,
        outageStartDate: health.offline ? deviceOutageStartDate(health) : null,
      },
    })
  } catch (error) {
    return serverError(log, error, "Could not check the clock-in device status.")
  }
}
