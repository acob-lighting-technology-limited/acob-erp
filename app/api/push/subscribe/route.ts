import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const log = logger("api-push-subscribe")

interface SubscriptionBody {
  subscription?: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
}

export async function POST(req: Request) {
  const rl = await rateLimit(`push-subscribe:${getClientId(req)}`, { limit: 20, windowSec: 300 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as SubscriptionBody
    const endpoint = body.subscription?.endpoint
    const p256dh = body.subscription?.keys?.p256dh
    const auth = body.subscription?.keys?.auth

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 })
    }

    // Endpoint is unique across the table: one browser install, one row. If the
    // same device re-subscribes, or a shared device changes hands, the row is
    // reassigned to the current user rather than duplicated.
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get("user-agent")?.slice(0, 512) || null,
        failure_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    )

    if (error) {
      log.error({ err: error.message, userId: user.id }, "push subscribe failed")
      return NextResponse.json({ error: "Could not register this device." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "push subscribe error")
    return NextResponse.json({ error: "Could not register this device." }, { status: 500 })
  }
}
