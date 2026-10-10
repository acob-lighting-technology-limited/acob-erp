import { NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { STARLINK_ALERTS_SETTINGS_KEY, loadAlertsConfig } from "@/lib/starlink/billing-alerts"
import { requireStarlinkKitAccess } from "@/lib/starlink/kit-access"

export const dynamic = "force-dynamic"

const log = logger("starlink-alerts-config")

const RuleSchema = z.object({
  enabled: z.boolean(),
  recipientUserIds: z.array(z.string().uuid()).max(50),
})

const ConfigSchema = z.object({
  failed: RuleSchema,
  due: RuleSchema.extend({ daysBefore: z.number().int().min(0).max(14) }),
})

/** GET /api/starlink/alerts — who receives Starlink failed / due alerts. */
export async function GET() {
  const access = await requireStarlinkKitAccess()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  return NextResponse.json({ data: await loadAlertsConfig(access.dataClient) })
}

/** PATCH /api/starlink/alerts — save the alert settings. */
export async function PATCH(request: Request) {
  const access = await requireStarlinkKitAccess()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const parsed = ConfigSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 })
  }
  for (const [name, rule] of Object.entries(parsed.data)) {
    if (rule.enabled && rule.recipientUserIds.length === 0) {
      return NextResponse.json(
        { error: `Choose at least one recipient for ${name === "failed" ? "failed payments" : "bills coming due"}` },
        { status: 400 }
      )
    }
  }

  const { error } = await access.dataClient.from("system_settings").upsert(
    {
      key: STARLINK_ALERTS_SETTINGS_KEY,
      value: parsed.data,
      description: "Who is alerted when a Starlink kit payment fails or its bill is coming due",
      updated_by: access.userId,
    },
    { onConflict: "key" }
  )
  if (error) {
    log.error({ err: error.message }, "Failed to save Starlink alert settings")
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog(
    access.supabase,
    {
      action: "update",
      entityType: "system_settings",
      entityId: STARLINK_ALERTS_SETTINGS_KEY,
      newValues: parsed.data,
      context: { actorId: access.userId, source: "api", route: "/api/starlink/alerts" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ data: parsed.data })
}
