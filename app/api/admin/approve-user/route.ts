import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { renderWelcomeEmail } from "@/lib/email-templates/welcome"
import { renderInternalNotificationEmail } from "@/lib/email-templates/internal-notification"
import { resolveActiveLeadRecipients, sendNotificationEmail } from "@/lib/notifications/email-gateway"
import { isSystemNotificationChannelEnabled, resolveChannelEligibleUserIds } from "@/lib/notifications/delivery-policy"
import { withSubjectPrefix } from "@/lib/notifications/subject-policy"
import { syncEmploymentStatusToAuth } from "@/lib/supabase/admin"

const log = logger("approve-user")

export async function POST(req: Request) {
  const rl = rateLimit(`approve-user:${getClientId(req)}`, { limit: 20, windowSec: 600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  // 1. Verify Caller is an Admin
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", caller.id).single()
  if (!callerProfile || !["developer", "super_admin", "admin"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  log.info({ callerId: caller.id }, "Starting approval process")
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      log.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "System configuration error: Missing database keys" }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json()
    const { pendingUserId, employeeId: manualEmployeeId, hireDate } = body

    if (!pendingUserId) {
      return NextResponse.json({ error: "Missing pendingUserId" }, { status: 400 })
    }

    // 1. Fetch Pending User Details
    const { data: pendingUser, error: fetchError } = await supabaseAdmin
      .from("pending_users")
      .select("*")
      .eq("id", pendingUserId)
      .single()

    if (fetchError || !pendingUser) {
      return NextResponse.json({ error: "Pending user not found" }, { status: 404 })
    }

    // 1b. Validate Required Fields
    const requiredFields = ["company_email", "personal_email", "first_name", "last_name", "department", "company_role"]
    const missingFields = requiredFields.filter((field) => !pendingUser[field])

    if (missingFields.length > 0) {
      return NextResponse.json({ error: `Missing required user data: ${missingFields.join(", ")}` }, { status: 422 })
    }

    // 2. Determine Employee ID — use DB sequence for atomic, collision-free generation
    let employeeId = manualEmployeeId
    const currentYear = new Date().getFullYear()

    if (employeeId) {
      const empNumPattern = /^ACOB\/[0-9]{4}\/[0-9]{3}$/
      if (!empNumPattern.test(employeeId)) {
        return NextResponse.json(
          { error: "Employee number must be in format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)" },
          { status: 400 }
        )
      }
    }

    if (!employeeId) {
      // next_employee_number() calls nextval() on a sequence — fully atomic, no race condition
      const { data: seqRow, error: seqError } = await supabaseAdmin
        .rpc("next_employee_number")
      if (seqError || !seqRow) {
        throw new Error(`Failed to generate employee number: ${seqError?.message ?? "unknown error"}`)
      }
      employeeId = seqRow as string
    }

    const tempPassword = `Welcome${currentYear}!`
    const portalUrl = "https://acoblighting.com/mail"

    // 3. Create or Update Auth User
    // First check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("company_email", pendingUser.company_email)
      .maybeSingle()

    let authUserId = existingProfile?.id

    if (!authUserId) {
      const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: pendingUser.company_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: pendingUser.first_name,
          last_name: pendingUser.last_name,
          full_name: `${pendingUser.first_name} ${pendingUser.last_name}`,
        },
      })

      if (authError) {
        throw new Error(`Auth creation failed: ${authError.message}`)
      }
      authUserId = newAuthUser.user.id
    } else {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: tempPassword,
        email_confirm: true,
      })
      if (updateAuthError) {
        throw new Error(`Auth update failed: ${updateAuthError.message}`)
      }
    }

    // 4 & 5. Atomically upsert profile + delete from pending_users in one DB transaction.
    // If either step fails, both roll back — no ghost users, no orphaned profiles.
    const { error: approvalError } = await supabaseAdmin.rpc("atomic_complete_user_approval", {
      p_auth_user_id:        authUserId,
      p_pending_user_id:     pendingUserId,
      p_employee_number:     employeeId,
      p_first_name:          pendingUser.first_name,
      p_last_name:           pendingUser.last_name,
      p_other_names:         pendingUser.other_names ?? null,
      p_department:          pendingUser.department,
      p_company_role:        pendingUser.company_role,
      p_company_email:       pendingUser.company_email,
      p_personal_email:      pendingUser.personal_email,
      p_phone_number:        pendingUser.phone_number ?? null,
      p_additional_phone:    pendingUser.additional_phone_number ?? null,
      p_residential_address: pendingUser.residential_address ?? null,
      p_office_location:     pendingUser.office_location ?? null,
      p_employment_date:     hireDate ?? null,
    })

    if (approvalError) {
      // Clean up orphaned auth user if we just created one
      if (!existingProfile && authUserId) {
        await supabaseAdmin.auth.admin
          .deleteUser(authUserId)
          .catch((e) => log.error({ err: String(e) }, "Failed to clean up orphaned auth user"))
      }
      throw new Error(`Profile creation failed: ${approvalError.message}`)
    }

    // 6. Send Welcome Email
    try {
      const onboardingMailEnabled = await isSystemNotificationChannelEnabled(supabaseAdmin, "onboarding", "email")
      if (onboardingMailEnabled) {
        await sendNotificationEmail({
          to: [pendingUser.personal_email],
          subject: withSubjectPrefix("Onboarding", "Welcome to ACOB - Login Credentials"),
          html: renderWelcomeEmail({ pendingUser, employeeId, tempPassword, portalUrl }),
        })
      }
    } catch (emailError) {
      log.error({ err: String(emailError) }, "Failed to send welcome email")
    }

    // 7. Send Internal Confirmation Email to Department Leads
    try {
      const onboardingMailEnabled = await isSystemNotificationChannelEnabled(supabaseAdmin, "onboarding", "email")
      if (onboardingMailEnabled) {
        const leadRecipients = await resolveActiveLeadRecipients(supabaseAdmin)
        const leadIds = leadRecipients.map((lead) => lead.id)
        const allowedLeadIds = await resolveChannelEligibleUserIds(supabaseAdmin, {
          userIds: leadIds,
          notificationKey: "onboarding",
          channel: "email",
        })
        const allowedIdSet = new Set(allowedLeadIds)
        const leadEmails = leadRecipients.filter((lead) => allowedIdSet.has(lead.id)).flatMap((lead) => lead.emails)

        if (leadEmails.length > 0) {
          await sendNotificationEmail({
            to: leadEmails,
            subject: withSubjectPrefix(
              "Onboarding",
              `New Employee Onboarded - ${pendingUser.first_name.replace(/[\r\n]/g, "")} ${pendingUser.last_name.replace(/[\r\n]/g, "")}`
            ),
            html: renderInternalNotificationEmail({ pendingUser, employeeId }),
          })
        }
      }
    } catch (emailError) {
      log.error({ err: String(emailError) }, "Failed to send stakeholder notification emails")
    }

    // Sync employment_status into JWT metadata so middleware doesn't need a DB query
    await syncEmploymentStatusToAuth(authUserId!, "active")

    return NextResponse.json({ success: true, employeeId })
  } catch (error: any) {
    log.error({ err: String(error) }, "Approval process failed")
    // Redact internal error details from the client
    const message = error.message?.includes("Auth creation failed")
      ? error.message
      : "An unexpected error occurred during the approval process. Please check system logs."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
