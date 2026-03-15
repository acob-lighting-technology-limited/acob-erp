import { NextRequest, NextResponse } from "next/server"
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
  const rl = rateLimit(`telemetry:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  try {
    const payload = (await request.json()) as ErrorPayload
    const message = truncate(String(payload?.message || "").trim(), 600)
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase as any)
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
