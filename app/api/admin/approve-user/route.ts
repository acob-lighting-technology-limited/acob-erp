import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient as createServerClient } from "@/lib/supabase/server"
import crypto from "crypto"
import { renderWelcomeEmail } from "@/lib/email-templates/welcome"
import { renderInternalNotificationEmail } from "@/lib/email-templates/internal-notification"

export async function POST(req: Request) {
  // 1. Verify Caller is an Admin
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", caller.id).single()
  if (!callerProfile || !["super_admin", "admin"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  console.log("--- Starting Approval Process ---")
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("CRITICAL ERROR: Missing Supabase environment variables")
      return NextResponse.json({ error: "System configuration error: Missing database keys" }, { status: 500 })
    }

    if (!resendApiKey) {
      console.error("ERROR: Missing RESEND_API_KEY environment variable")
      return NextResponse.json({ error: "Email configuration error: Missing API key" }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
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

    // 2. Determine Employee ID with Retry Logic for Race Conditions
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
      let retryCount = 0
      const maxRetries = 3
      while (retryCount < maxRetries) {
        const { data: lastProfile } = await supabaseAdmin
          .from("profiles")
          .select("employee_number")
          .not("employee_number", "is", null)
          .order("employee_number", { ascending: false })
          .limit(1)
          .single()

        let nextIdNumber = 1
        if (lastProfile && lastProfile.employee_number) {
          const parts = lastProfile.employee_number.split("/")
          if (parts.length === 3) {
            const lastNum = parseInt(parts[2], 10)
            if (!isNaN(lastNum)) nextIdNumber = lastNum + retryCount + 1
          }
        }
        employeeId = `ACOB/${currentYear}/${nextIdNumber.toString().padStart(3, "0")}`

        // Check if this ID is already taken
        const { data: exists } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("employee_number", employeeId)
          .single()
        if (!exists) break
        retryCount++
      }

      if (retryCount >= maxRetries) {
        throw new Error(
          "Failed to generate a unique employee ID after multiple attempts. Please try again or specify an ID manually."
        )
      }
    }

    // Secure Token-based Setup Flow
    const setupToken = crypto.randomBytes(32).toString("hex")
    // Store hash in DB, email raw token
    const setupTokenHash = crypto.createHash("sha256").update(setupToken).digest("hex")
    const setupTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    const publicUrl = process.env.NEXT_PUBLIC_APP_URL || "https://erp.acoblighting.com"
    const setupUrl = `${publicUrl}/auth/setup-account?token=${setupToken}`

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
        password: crypto.randomBytes(16).toString("hex"), // Random secure original password
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
    }

    // 4. Upsert Profile Record with Retry for Employee ID
    let profileError = null
    let retryUpsert = 0
    const maxUpsertRetries = 3

    while (retryUpsert < maxUpsertRetries) {
      // If employeeId is NOT manually set and we are retrying, regenerate it
      if (!manualEmployeeId && retryUpsert > 0) {
        const { data: lastProfile } = await supabaseAdmin
          .from("profiles")
          .select("employee_number")
          .not("employee_number", "is", null)
          .order("employee_number", { ascending: false })
          .limit(1)
          .single()

        let nextIdNumber = 1
        if (lastProfile && lastProfile.employee_number) {
          const parts = lastProfile.employee_number.split("/")
          if (parts.length === 3) {
            const lastNum = parseInt(parts[2], 10)
            if (!isNaN(lastNum)) nextIdNumber = lastNum + retryUpsert + 1
          }
        }
        employeeId = `ACOB/${currentYear}/${nextIdNumber.toString().padStart(3, "0")}`
      }

      const { error } = await supabaseAdmin.from("profiles").upsert(
        {
          id: authUserId,
          first_name: pendingUser.first_name,
          last_name: pendingUser.last_name,
          other_names: pendingUser.other_names,
          department: pendingUser.department,
          company_role: pendingUser.company_role,
          role: "employee",
          employment_status: "active",
          employee_number: employeeId,
          company_email: pendingUser.company_email,
          personal_email: pendingUser.personal_email,
          phone_number: pendingUser.phone_number,
          additional_phone: pendingUser.additional_phone_number,
          residential_address: pendingUser.residential_address,
          current_work_location: pendingUser.current_work_location,
          office_location: pendingUser.office_location,
          employment_date: hireDate || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          setup_token: setupTokenHash,
          setup_token_expires_at: setupTokenExpiresAt,
          must_reset_password: true,
        },
        { onConflict: "id" }
      )

      if (!error) {
        profileError = null
        break
      }

      // Check for employee_number unique constraint violation
      // Postgres error code 23505 is unique_violation
      if (error && error.code === "23505" && error.message.includes("profiles_employee_number_key")) {
        console.warn(`Employee ID collision for ${employeeId}, retrying...`)
        retryUpsert++
        profileError = error
        continue
      } else {
        // Other errors are fatal
        profileError = error
        break
      }
    }

    if (profileError) {
      // Clean up orphaned auth user if we just created one
      if (!existingProfile && authUserId) {
        await supabaseAdmin.auth.admin
          .deleteUser(authUserId)
          .catch((e) => console.error("Failed to clean up orphaned auth user:", e))
      }
      throw new Error(`Profile creation failed: ${profileError.message}`)
    }

    // 5. Delete from Pending Users
    const { error: deleteError } = await supabaseAdmin.from("pending_users").delete().eq("id", pendingUserId)
    if (deleteError) {
      console.error("CRITICAL ERROR: Failed to delete pending user record after profile creation", deleteError)
      // We don't throw because the profile is already created, but this is a serious data integrity issue
    }

    // 6. Send Welcome Email
    try {
      await resend.emails.send({
        from: "ACOB Admin & HR <notifications@acoblighting.com>",
        to: [pendingUser.personal_email],
        subject: "Welcome to ACOB - Login Credentials",
        html: renderWelcomeEmail({ pendingUser, employeeId, setupUrl }),
      })
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError)
    }

    // 7. Send Internal Confirmation Email to Stakeholders
    try {
      const stakeholderEmails = (process.env.STAKEHOLDER_EMAILS || "")
        .split(",")
        .map((e: string) => e.trim())
        .filter((e: string) => e.includes("@"))

      if (stakeholderEmails.length > 0) {
        await resend.emails.send({
          from: "ACOB Admin & HR <notifications@acoblighting.com>",
          to: stakeholderEmails,
          subject: `New Employee Onboarded - ${pendingUser.first_name.replace(/[\r\n]/g, "")} ${pendingUser.last_name.replace(/[\r\n]/g, "")}`,
          html: renderInternalNotificationEmail({ pendingUser, employeeId }),
        })
      }
    } catch (emailError) {
      console.error("Failed to send stakeholder notification emails:", emailError)
    }

    return NextResponse.json({ success: true, employeeId })
  } catch (error: any) {
    console.error("Approval Process Error:", error)
    // Redact internal error details from the client
    const message = error.message?.includes("Auth creation failed")
      ? error.message
      : "An unexpected error occurred during the approval process. Please check system logs."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
