import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { enforceRouteAccessV2, requireAccessContextV2 } from "@/lib/admin/api-guard-v2"
import { logger } from "@/lib/logger"
import { serverError, validationError } from "@/lib/api/errors"
import { AttendancePolicySchema } from "@/lib/hr/attendance-policy-schema"

const log = logger("admin-settings-attendance")

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const contextResult = await requireAccessContextV2()
    if (!contextResult.ok) return contextResult.response
    const routeAccess = enforceRouteAccessV2(contextResult.context, "hr.attendance")
    if (!routeAccess.ok) return routeAccess.response

    const body = await request.json()
    const parsed = AttendancePolicySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const {
      startTime,
      endTime,
      lateCutoff,
      incompletePenalty,
      lunchMinutes,
      lunchQualifyingHours,
      emailNotificationsEnabled,
    } = parsed.data

    if (endTime <= startTime) {
      return NextResponse.json({ error: "Workday end time must be after the start time" }, { status: 400 })
    }
    if (lateCutoff < startTime || lateCutoff >= endTime) {
      return NextResponse.json({ error: "Grace cutoff must fall inside the workday" }, { status: 400 })
    }

    // system_settings only grants write access to the `developer` role at the DB
    // level, so an authorised HR/admin caller is blocked by RLS on the user-scoped
    // client. Authorisation is already enforced above via the hr.attendance route
    // guard; the write goes through the service-role client like every other
    // settings route does.
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const { error } = await dataClient.from("system_settings").upsert(
      {
        key: "attendance_policy",
        value: {
          startTime,
          endTime,
          lateCutoff,
          incompletePenalty,
          lunchMinutes,
          lunchQualifyingHours,
          emailNotificationsEnabled: emailNotificationsEnabled ?? true,
        },
        description: "Workday timing configurations and lateness/incomplete penalties",
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" }
    )

    if (error) {
      log.error({ err: error.message }, "Failed to save attendance policy")
      return serverError(log, error)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
