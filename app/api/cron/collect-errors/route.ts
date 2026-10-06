import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { telemetryClient, persistFailure } from "@/lib/telemetry/server"
import { platformQuery, PlatformLogSchema, logWindow } from "@/lib/telemetry/platform"
import { rateLimit } from "@/lib/rate-limit"
import { maintainErrorMonitor } from "@/lib/telemetry/maintenance"

export const runtime = "nodejs"
export const maxDuration = 60

type RuntimeSecrets = { management_token: string | null; cron_secret: string | null }
type RuntimeSecretsClient = {
  rpc: (
    fn: "get_error_monitor_runtime_secrets",
    args: Record<string, never>
  ) => Promise<{ data: RuntimeSecrets[] | null; error: { message: string } | null }>
}

async function getRuntimeSecrets() {
  const client = telemetryClient() as unknown as RuntimeSecretsClient
  const { data, error } = await client.rpc("get_error_monitor_runtime_secrets", {})
  if (error) throw new Error("Unable to load Error Monitor runtime configuration")
  return data?.[0] || { management_token: null, cron_secret: null }
}

export async function GET(request: NextRequest) {
  let runtime: RuntimeSecrets
  try {
    runtime = await getRuntimeSecrets()
  } catch {
    return NextResponse.json({ error: "Error Monitor is not configured" }, { status: 503 })
  }
  const expected = Buffer.from(`Bearer ${runtime.cron_secret || ""}`)
  const supplied = Buffer.from(request.headers.get("authorization") || "")
  if (!runtime.cron_secret || supplied.length !== expected.length || !expected.equals(supplied)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const rl = await rateLimit("platform-error-collector", { limit: 1, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Collection already requested" }, { status: 429 })
  try {
    const client = telemetryClient()
    if (!runtime.management_token) {
      await maintainErrorMonitor()
      return NextResponse.json({ ok: true, platformConfigured: false, imported: 0 })
    }
    const { data: setting, error: settingError } = await client
      .from("system_settings")
      .select("value")
      .eq("key", "error_monitor_collector")
      .maybeSingle()
    if (settingError) throw new Error("Unable to read collector checkpoint")
    const cursor = z
      .object({
        cursor: z.string().optional(),
        page: z.object({ timestamp: z.string(), id: z.string(), start: z.string(), end: z.string() }).optional(),
      })
      .safeParse(setting?.value)
    const page = cursor.success ? cursor.data.page : undefined
    const window = page
      ? { start: page.start, end: page.end }
      : logWindow(cursor.success ? cursor.data.cursor : undefined)
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]
    const url = new URL(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs`)
    url.searchParams.set("sql", platformQuery(page))
    url.searchParams.set("iso_timestamp_start", window.start)
    url.searchParams.set("iso_timestamp_end", window.end)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${runtime.management_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error(`Platform log API returned ${response.status}`)
    const body = z
      .object({ result: z.array(PlatformLogSchema), error: z.string().nullable().optional() })
      .parse(await response.json())
    if (body.error) throw new Error("Platform log query failed")
    // Deterministic IDs prevent duplicate ingestion across overlapping windows and retries.
    const rows = body.result.map((row) => {
      const hex = createHash("sha256").update(`${ref}|${row.source}|${row.id}`).digest("hex")
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
      return { ...row, eventId: id }
    })
    const { data: existing, error: existingError } = rows.length
      ? await client
          .from("audit_logs")
          .select("id")
          .in(
            "id",
            rows.map((row) => row.eventId)
          )
      : { data: [], error: null }
    if (existingError) throw new Error("Unable to check existing events")
    const known = new Set((existing || []).map((row) => row.id as string))
    let imported = 0
    const pending = rows.filter((row) => !known.has(row.eventId))
    for (let index = 0; index < pending.length; index += 10) {
      const batch = pending.slice(index, index + 10)
      const ids = await Promise.all(
        batch.map((row) =>
          persistFailure({
            source: `supabase.platform.${row.source}`,
            eventId: row.eventId,
            route: row.path || "/supabase",
            message: row.event_message,
            context: {
              platformEventId: row.id,
              platformTimestamp: row.timestamp,
              service: row.source,
              status: Number(row.status) || undefined,
            },
          })
        )
      )
      if (ids.some((id) => !id)) throw new Error("Unable to persist platform event")
      imported += ids.length
    }
    const saturated = rows.length === 500
    // On saturation, retry the window rather than silently skipping later events.
    const last = rows[rows.length - 1]
    const checkpoint = {
      cursor: window.end,
      last_success: new Date().toISOString(),
      imported,
      saturated,
      page: saturated && last ? { timestamp: last.timestamp, id: last.id, ...window } : undefined,
    }
    const { error: checkpointError } = await client.from("system_settings").upsert({
      key: "error_monitor_collector",
      value: checkpoint,
      description: "Supabase error log collector checkpoint",
      updated_at: new Date().toISOString(),
    })
    if (checkpointError) throw new Error("Unable to save collector checkpoint")
    await maintainErrorMonitor()
    return NextResponse.json({ ok: true, imported, saturated })
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Platform log response did not match the expected schema"
        : error instanceof Error
          ? error.message
          : "Collection failed"
    await persistFailure({ source: "server.collector", route: "/api/cron/collect-errors", message })
    // App alerts and retention still run if platform access is unavailable.
    await maintainErrorMonitor().catch(() => undefined)
    return NextResponse.json({ error: "Platform log collection failed; inspect Error Monitor" }, { status: 502 })
  }
}
