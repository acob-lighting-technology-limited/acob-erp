import { NextResponse } from "next/server"
import { getMailbox, isCpanelConfigured } from "@/lib/cpanel/client"
import { logger } from "@/lib/logger"
import { buildIosMailProfile } from "@/lib/mail/ios-profile"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const log = logger("profile-ios-mail-profile")

/**
 * GET /api/profile/mailbox/ios-profile — downloads an Apple configuration
 * profile that adds the signed-in user's OWN company mailbox to iPhone Mail.
 * Opened directly in Safari (a GET so iOS hands it to Settings). The address
 * comes from the user's profile, never the request, and the profile carries no
 * password — iOS asks for it on install.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_email, first_name, last_name, full_name, employment_status")
    .eq("id", user.id)
    .maybeSingle<{
      company_email: string | null
      first_name: string | null
      last_name: string | null
      full_name: string | null
      employment_status: string | null
    }>()

  const email = profile?.company_email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: "You have no company email on your profile" }, { status: 404 })
  if (profile?.employment_status === "exited" || profile?.employment_status === "suspended") {
    return NextResponse.json({ error: "Email setup is not available for this account" }, { status: 403 })
  }

  // Only hand out a profile for a mailbox that exists and can log in, so nobody
  // installs an account that can never connect.
  if (isCpanelConfigured()) {
    try {
      const mailbox = await getMailbox(email)
      if (!mailbox) return NextResponse.json({ error: "No mailbox exists for your company email" }, { status: 404 })
      if (mailbox.suspendedLogin) {
        return NextResponse.json({ error: "Your mailbox login is suspended — contact ICT" }, { status: 403 })
      }
    } catch (err) {
      log.warn({ err: String(err), userId: user.id }, "Could not check mailbox before building iOS profile")
    }
  }

  const displayName =
    profile?.full_name?.trim() || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || email

  return new NextResponse(buildIosMailProfile({ email, displayName }), {
    headers: {
      "Content-Type": "application/x-apple-aspen-config; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ACOB-Work-Email.mobileconfig"',
      "Cache-Control": "no-store",
    },
  })
}
