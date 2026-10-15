import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canAccessAdminSection, resolveAdminScope } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { isCpanelConfigured } from "@/lib/cpanel/client"
import { provisionStaffMailbox } from "@/lib/employees/mailbox-provisioning"
import { WELCOME_PROFILE_COLUMNS, sendMailboxWelcome, type WelcomeProfile } from "@/lib/employees/mailbox-welcome"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"

const log = logger("api-dispatch-credentials")

interface RouteContext {
  params: Promise<{ userId: string }>
}

/**
 * POST /api/admin/hr/employees/[userId]/dispatch-credentials
 *
 * Sends the welcome letter (webmail password + Matrix activation link) to the
 * employee's personal email. Two modes:
 * - automatic (no `password` in the body): Matrix creates the cPanel mailbox,
 *   or resets its password if it exists, with a generated password. This is
 *   also the retry for a mailbox that failed to create on approval.
 * - manual (`password` given): ICT already set the mailbox up in cPanel and
 *   types the password they chose.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId: id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing employee ID" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase, user.id)
    if (!scope || !canAccessAdminSection(scope, "hr")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as { password?: string }
    const manualPassword = body.password?.trim() || null
    if (manualPassword !== null && manualPassword.length < 6) {
      return NextResponse.json({ error: "A valid password of at least 6 characters is required" }, { status: 400 })
    }
    if (manualPassword === null && !isCpanelConfigured()) {
      return NextResponse.json(
        { error: "Automatic mailbox setup is unavailable (cPanel not configured). Enter the password ICT set." },
        { status: 400 }
      )
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    const { data: profile, error: profileErr } = await dataClient
      .from("profiles")
      .select(WELCOME_PROFILE_COLUMNS)
      .eq("id", id)
      .single<WelcomeProfile>()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 })
    }
    if (!profile.personal_email) {
      return NextResponse.json(
        { error: "Employee does not have a personal email on file to receive credentials" },
        { status: 422 }
      )
    }
    if (!profile.company_email) {
      return NextResponse.json({ error: "Employee does not have a company email assigned" }, { status: 422 })
    }

    let mailboxPassword = manualPassword
    let mailboxCreated: boolean | null = null
    if (mailboxPassword === null) {
      const provisioned = await provisionStaffMailbox(dataClient, {
        profileId: profile.id,
        email: profile.company_email,
      })
      if (!provisioned.ok) {
        return NextResponse.json({ error: `Mailbox not set up: ${provisioned.reason}` }, { status: 502 })
      }
      mailboxPassword = provisioned.password
      mailboxCreated = provisioned.created
    }

    // Fetch caller profile for the email signature
    const { data: callerProfile } = await dataClient
      .from("profiles")
      .select("full_name, designation, department")
      .eq("id", user.id)
      .maybeSingle()

    const result = await sendMailboxWelcome(dataClient, {
      profile,
      mailboxPassword,
      preparedBy: {
        name: callerProfile?.full_name || "Admin & IT",
        designation: callerProfile?.designation || "Administrator",
        department: callerProfile?.department || "Admin and HR",
      },
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await writeAuditLog(
      supabase,
      {
        action: "dispatch_webmail_credentials",
        entityType: "profile",
        entityId: id,
        newValues: {
          recipient: result.recipient,
          company_email: profile.company_email,
          dispatched_at: result.dispatchedAt,
          mailbox: mailboxCreated === null ? "manual" : mailboxCreated ? "created" : "password_reset",
        },
        context: {
          actorId: user.id,
          department: scope.department,
          source: "api",
          route: `/api/admin/hr/employees/${id}/dispatch-credentials`,
        },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      success: true,
      message: "Webmail credentials dispatched successfully",
      dispatchedAt: result.dispatchedAt,
      mailbox: mailboxCreated === null ? "manual" : mailboxCreated ? "created" : "password_reset",
      warnings: result.warnings,
    })
  } catch (error) {
    log.error({ error }, "Unhandled error in dispatch-credentials")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
