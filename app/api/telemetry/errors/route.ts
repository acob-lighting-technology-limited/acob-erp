import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const log = logger("telemetry-errors")

type ErrorSource = "window.error" | "unhandledrejection" | "react.error_boundary" | "react.global_error_boundary"

interface ErrorPayload {
  source?: ErrorSource | string
  message?: string
  stack?: string | null
  route?: string
  href?: string
  userAgent?: string
  context?: Record<string, unknown>
  timestamp?: string
}

const TelemetryErrorSchema = z.object({
  source: z.string().optional(),
  message: z.string().trim().min(1, "message is required"),
  stack: z.string().nullable().optional(),
  route: z.string().optional(),
  href: z.string().optional(),
  userAgent: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
})

function truncate(value: string | null | undefined, max = 1000): string | null {
  if (!value) return null
  return value.length > max ? `${value.slice(0, max)}...` : value
}

function getFirstIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp
  return null
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`telemetry:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  try {
    const body = (await request.json()) as ErrorPayload
    const parsed = TelemetryErrorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid_payload" }, { status: 400 })
    }

    const payload = parsed.data
    const message = truncate(payload.message, 600)

    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let department: string | null = null
    if (user?.id) {
      const { data: profile } = await dataClient.from("profiles").select("department").eq("id", user.id).maybeSingle()
      department = profile?.department || null
    }

    const metadata = {
      source: truncate(payload?.source || "window.error", 120),
      route: truncate(payload?.route || null, 300),
      href: truncate(payload?.href || null, 700),
      stack: truncate(payload?.stack || null, 5000),
      context: payload?.context || {},
      timestamp: payload?.timestamp || new Date().toISOString(),
      user_agent: truncate(payload?.userAgent || request.headers.get("user-agent"), 700),
    }

    const insertPayload = {
      user_id: user?.id || null,
      operation: "error",
      table_name: "frontend",
      record_id: truncate(payload?.route || payload?.href || null, 255),
      status: "error",
      error_details: message,
      metadata,
      action: "client_error",
      entity_type: "ui_runtime",
      department,
      ip_address: getFirstIp(request),
      user_agent: truncate(payload?.userAgent || request.headers.get("user-agent"), 700),
    }

    const { data, error } = await dataClient.from("audit_logs").insert(insertPayload).select("id").single()

    if (error) {
      log.error({ err: String(error) }, "Telemetry insert failed:")
      return NextResponse.json({ error: "failed_to_log" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, eventId: data?.id || null })
  } catch (error) {
    log.error({ err: String(error) }, "Telemetry route failed:")
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }
}
