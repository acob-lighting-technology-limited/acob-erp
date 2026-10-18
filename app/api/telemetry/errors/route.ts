import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { persistFailure } from "@/lib/telemetry/server"

const schema = z.object({
  source: z.enum([
    "window.error",
    "unhandledrejection",
    "react.error_boundary",
    "react.global_error_boundary",
    "http.error",
    "supabase.request",
    "action.error",
  ]),
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(5000).nullable().optional(),
  route: z.string().max(300).optional(),
  context: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const rl = await rateLimit(`telemetry:${getClientId(request)}`, { limit: 60, windowSec: 60 })
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    const text = await request.text()
    if (text.length > 20000) return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    const parsed = schema.safeParse(JSON.parse(text))
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const eventId = await persistFailure({
      ...parsed.data,
      userId: user?.id,
      context: {
        ...parsed.data.context,
        requestId: parsed.data.context?.requestId || request.headers.get("x-request-id"),
      },
    })
    if (!eventId) return NextResponse.json({ error: "failed_to_log" }, { status: 503 })
    return NextResponse.json({ ok: true, eventId })
  } catch {
    return NextResponse.json({ error: "Unable to record error" }, { status: 400 })
  }
}
