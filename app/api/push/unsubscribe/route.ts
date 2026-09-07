import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger("api-push-unsubscribe")

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { endpoint?: string }
    if (!body.endpoint) {
      return NextResponse.json({ error: "Missing endpoint." }, { status: 400 })
    }

    // Scoped to the caller as well as the endpoint: RLS already enforces this,
    // but being explicit means a leaked endpoint can't unregister someone else.
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", body.endpoint)
      .eq("user_id", user.id)

    if (error) {
      log.error({ err: error.message, userId: user.id }, "push unsubscribe failed")
      return NextResponse.json({ error: "Could not remove this device." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "push unsubscribe error")
    return NextResponse.json({ error: "Could not remove this device." }, { status: 500 })
  }
}
