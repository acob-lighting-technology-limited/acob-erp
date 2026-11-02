import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { enforceRouteAccessV2, requireAccessContextV2 } from "@/lib/admin/api-guard-v2"
import { DEVICE_ALERT_RECIPIENTS_KEY, getDeviceAlertRecipientIds } from "@/lib/hr/device-health"
import { logger } from "@/lib/logger"
import { serverError } from "@/lib/api/errors"

const log = logger("hr-attendance-device-alert-config")

const PatchSchema = z.object({
  recipientUserIds: z.array(z.string().uuid()).max(50),
})

/** Who is emailed and notified when the clock-in device stops sending punches. */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const contextResult = await requireAccessContextV2()
    if (!contextResult.ok) return contextResult.response
    const routeAccess = enforceRouteAccessV2(contextResult.context, "hr.attendance")
    if (!routeAccess.ok) return routeAccess.response

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const recipientUserIds = await getDeviceAlertRecipientIds(dataClient)
    return NextResponse.json({ data: { recipientUserIds } })
  } catch (error) {
    return serverError(log, error, "Could not load device alert recipients.")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const contextResult = await requireAccessContextV2()
    if (!contextResult.ok) return contextResult.response
    const routeAccess = enforceRouteAccessV2(contextResult.context, "hr.attendance")
    if (!routeAccess.ok) return routeAccess.response

    const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const { error } = await dataClient.from("system_settings").upsert(
      {
        key: DEVICE_ALERT_RECIPIENTS_KEY,
        value: { user_ids: Array.from(new Set(parsed.data.recipientUserIds)) },
        description: "Who is alerted when the clock-in device stops sending punches (the ICT mailbox always is)",
        updated_by: user.id,
      },
      { onConflict: "key" }
    )
    if (error) return serverError(log, error)
    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(log, error, "Could not save device alert recipients.")
  }
}
