import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { NOTIFICATION_KEYS, isNotificationKey } from "@/lib/notifications/delivery-policy"

type PolicyUpdatePayload = {
  notification_key: string
  in_app_enabled?: boolean
  email_enabled?: boolean
  in_app_mandatory?: boolean
  email_mandatory?: boolean
}

async function requirePrivilegedActor(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!["super_admin", "developer"].includes(profile?.role)) {
    return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user, error: null }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await requirePrivilegedActor(supabase)
    if (auth.error) return auth.error

    const admin = getServiceRoleClientOrFallback(supabase as any)

    const { data, error } = await admin
      .from("notification_delivery_policies")
      .select(
        "notification_key, in_app_enabled, email_enabled, in_app_mandatory, email_mandatory, updated_by, updated_at"
      )
      .in("notification_key", [...NOTIFICATION_KEYS])
      .order("notification_key")

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ policies: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "An error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await requirePrivilegedActor(supabase)
    if (auth.error) return auth.error

    const body = await request.json()
    const inputPolicies = Array.isArray(body?.policies) ? (body.policies as PolicyUpdatePayload[]) : []

    if (inputPolicies.length === 0) {
      return NextResponse.json({ error: "No policies provided" }, { status: 400 })
    }

    const payload = inputPolicies
      .filter((row) => isNotificationKey(String(row.notification_key || "")))
      .map((row) => ({
        notification_key: row.notification_key,
        in_app_enabled: row.in_app_enabled,
        email_enabled: row.email_enabled,
        in_app_mandatory: row.in_app_mandatory,
        email_mandatory: row.email_mandatory,
        updated_by: auth.user!.id,
        updated_at: new Date().toISOString(),
      }))

    if (payload.length === 0) {
      return NextResponse.json({ error: "No valid notification keys provided" }, { status: 400 })
    }

    for (const row of payload) {
      if (row.in_app_enabled === false && row.in_app_mandatory === true) {
        return NextResponse.json(
          { error: `In-app mandatory cannot be enabled while in-app delivery is disabled (${row.notification_key})` },
          { status: 400 }
        )
      }
      if (row.email_enabled === false && row.email_mandatory === true) {
        return NextResponse.json(
          { error: `Email mandatory cannot be enabled while email delivery is disabled (${row.notification_key})` },
          { status: 400 }
        )
      }
    }

    const admin = getServiceRoleClientOrFallback(supabase as any)

    const { error } = await admin.from("notification_delivery_policies").upsert(payload, {
      onConflict: "notification_key",
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "An error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
