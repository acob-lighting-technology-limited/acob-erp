import { NextResponse } from "next/server"
import { getMailbox, isCpanelConfigured } from "@/lib/cpanel/client"
import { logger } from "@/lib/logger"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const log = logger("profile-mailbox-api")

/**
 * GET /api/profile/mailbox — storage used by the signed-in user's own company
 * mailbox. The address comes from their profile, never from the request, so a
 * user can only ever see their own mailbox. `data: null` means there is nothing
 * to show (no cPanel mailbox for that address, or cPanel not configured).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isCpanelConfigured()) return NextResponse.json({ data: null })

  const { data: profile } = await supabase.from("profiles").select("company_email").eq("id", user.id).maybeSingle()
  const email = profile?.company_email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ data: null })

  try {
    const mailbox = await getMailbox(email)
    if (!mailbox) return NextResponse.json({ data: null })
    return NextResponse.json({
      data: {
        email: mailbox.email,
        usedBytes: mailbox.usedBytes,
        quotaBytes: mailbox.quotaBytes,
        usedPercent: mailbox.usedPercent,
      },
    })
  } catch (err) {
    log.error({ err: String(err), userId: user.id }, "Failed to read mailbox usage")
    return NextResponse.json({ error: "Could not read mailbox usage" }, { status: 502 })
  }
}
