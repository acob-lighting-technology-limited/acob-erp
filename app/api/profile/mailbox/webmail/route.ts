import { NextRequest, NextResponse } from "next/server"
import { CpanelError, createWebmailLoginUrl, getMailbox, isCpanelConfigured } from "@/lib/cpanel/client"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const log = logger("profile-webmail-sso")

/**
 * POST /api/profile/mailbox/webmail — a one-time link that opens Roundcube
 * signed in to the caller's OWN company mailbox, no mailbox password needed.
 * The address comes from their profile, never the request. POST (not GET) so
 * a link or prefetch can never mint a session.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`profile-webmail:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isCpanelConfigured()) return NextResponse.json({ error: "Webmail sign-in is not available" }, { status: 503 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_email, employment_status")
    .eq("id", user.id)
    .maybeSingle<{ company_email: string | null; employment_status: string | null }>()
  const email = profile?.company_email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: "You have no company email on your profile" }, { status: 404 })
  if (profile?.employment_status === "exited" || profile?.employment_status === "suspended") {
    return NextResponse.json({ error: "Webmail sign-in is not available for this account" }, { status: 403 })
  }

  try {
    const mailbox = await getMailbox(email)
    if (!mailbox) return NextResponse.json({ error: "No mailbox exists for your company email" }, { status: 404 })
    if (mailbox.suspendedLogin) {
      return NextResponse.json({ error: "Your mailbox login is suspended — contact ICT" }, { status: 403 })
    }
    const url = await createWebmailLoginUrl(email)
    log.info({ userId: user.id }, "Webmail session created")
    return NextResponse.json({ data: { url } })
  } catch (err) {
    log.error({ err: String(err), userId: user.id }, "Failed to create webmail session")
    return NextResponse.json(
      { error: err instanceof CpanelError ? err.message : "Could not open webmail" },
      { status: 502 }
    )
  }
}
