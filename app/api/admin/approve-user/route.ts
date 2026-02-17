import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient as createServerClient } from "@/lib/supabase/server"
import crypto from "crypto"

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

    const resend = new Resend(resendApiKey || "dummy_key")
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json()
    const { pendingUserId, employeeId: manualEmployeeId } = body

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

    // 2. Determine Employee ID with Retry Logic for Race Conditions
    let employeeId = manualEmployeeId
    const currentYear = new Date().getFullYear()

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
    }

    // Secure Token-based Setup Flow
    const setupToken = crypto.randomBytes(32).toString("hex")
    const setupTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    const publicUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "https://erp.acoblighting.com")
    const setupUrl = `${publicUrl}/auth/setup-account?token=${setupToken}`

    // 3. Create or Update Auth User
    // First check if user already exists
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers()
    let authUserId = users?.find((u) => u.email === pendingUser.company_email)?.id

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

    // 4. Upsert Profile Record (Handles cases where a trigger might have created a skeleton profile)
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        setup_token: setupToken,
        setup_token_expires_at: setupTokenExpiresAt,
        must_reset_password: true,
      },
      { onConflict: "id" }
    )

    if (profileError) {
      throw new Error(`Profile creation failed: ${profileError.message}`)
    }

    // 5. Delete from Pending Users
    await supabaseAdmin.from("pending_users").delete().eq("id", pendingUserId)

    // 6. Send Welcome Email
    try {
      await resend.emails.send({
        from: "ACOB HR <notifications@acoblighting.com>", // Using verified domain
        to: [pendingUser.personal_email], // Send to PERSONAL email
        subject: "Welcome to ACOB - Login Credentials",
        // Simple HTML construction based on the preview file we agreed on
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ACOB Lighting</title>
    <style>
        body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
        .outer-header { background: #000; width: 100%; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }
        .title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 14px; }
        .text { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 18px 0; }
        .card { margin-top: 22px; border: 1px solid #d1d5db; overflow: hidden; background: #f9fafb; }
        .card-header { padding: 12px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #d1d5db; }
        .status-header-neutral { background: #eff6ff; color: #1e40af; border-bottom-color: #bfdbfe; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 12px 18px; font-size: 14px; border-bottom: 1px solid #d1d5db; }
        tr:last-child td { border-bottom: none; }
        .label { width: 40%; color: #4b5563; font-weight: 500; border-right: 1px solid #d1d5db; }
        .value { color: #111827; font-weight: 600; }
        .credential { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; border: 1px solid #d1d5db; }
        .cta { text-align: center; margin-top: 32px; }
        .button { display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .support { text-align: center; font-size: 14px; color: #4b5563; margin-top: 24px; line-height: 1.5; }
        .support a { color: #16a34a; font-weight: 600; text-decoration: none; }
        .footer { background: #000; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }
        .footer strong { color: #fff; }
        .footer-system { color: #16a34a; font-weight: 600; }
        .footer-note { color: #9ca3af; font-style: italic; }
    </style>
</head>
<body>
    <div class="outer-header">
        <img src="https://erp.acoblighting.com/images/acob-logo-dark.webp" alt="ACOB Lighting" height="40">
    </div>
    <div class="wrapper">
        <div class="title">Welcome to the Team</div>
        <p class="text">Dear ${pendingUser.first_name},</p>
        <p class="text">We are thrilled to welcome you to the team at ACOB Lighting Technology Limited.</p>
        <p class="text">An official employee account has been created for you. Please find your login credentials and details below.</p>
        
        <div class="card">
            <div class="card-header status-header-neutral">Employee Profile</div>
            <table>
                <tr>
                    <td class="label">Full Name</td>
                    <td class="value">${pendingUser.first_name} ${pendingUser.last_name}</td>
                </tr>
                 <tr>
                    <td class="label">Employee ID</td>
                    <td class="value">${employeeId}</td>
                </tr>
                <tr>
                    <td class="label">Department</td>
                    <td class="value">${pendingUser.department}</td>
                </tr>
                <tr>
                    <td class="label">Role</td>
                    <td class="value">${pendingUser.company_role}</td>
                </tr>
                <tr>
                    <td class="label">Work Location</td>
                    <td class="value">
                        ${pendingUser.current_work_location}
                        ${
                          pendingUser.office_location &&
                          pendingUser.office_location !== pendingUser.current_work_location
                            ? `(${pendingUser.office_location})`
                            : ""
                        }
                    </td>
                </tr>
            </table>
        </div>

        <div class="card" style="margin-top: 20px;">
            <div class="card-header status-header-neutral" style="background: #f0fdf4; color: #15803d; border-bottom-color: #bbf7d0;">Account Activation</div>
            <table>
                <tr>
                    <td class="label">Setup URL</td>
                    <td class="value"><a href="${setupUrl}" style="color: #16a34a; text-decoration: none; font-weight: 700;">ACTIVATE MY ACCOUNT</a></td>
                </tr>
                <tr>
                    <td class="label">Company Email</td>
                    <td class="value"><span class="credential">${pendingUser.company_email}</span></td>
                </tr>
            </table>
        </div>

        <div class="cta">
            <a href="${setupUrl}" class="button">Set Up Password</a>
        </div>
        <div class="support">
            Please log in and change your password immediately.<br>
            If you have any questions, contact <a href="mailto:ict@acoblighting.com">ict@acoblighting.com</a>
        </div>
    </div>
    <div class="footer">
        <strong>ACOB Lighting Technology Limited</strong><br>
        ACOB Internal Systems – Admin & HR Department<br>
        <span class="footer-system">Employee Management System</span>
        <br><br>
        <i class="footer-note">This is an automated system notification. Please do not reply directly to this email.</i>
    </div>
</body>
</html>
            `,
      })

      // 7. Send Internal Confirmation Email to Stakeholders
      await resend.emails.send({
        from: "ACOB Internal Systems <notifications@acoblighting.com>",
        to: [
          "ict@acoblighting.com",
          "a.peter@acoblighting.com",
          "info@acoblighting.com",
          "acobacct@gmail.com",
          "a.lawrence@acoblighting.com",
          "i.emmanuel@acoblighting.com",
          "o.mercy@org.acoblighting.com",
          "infoacob@gmail.com",
          "e.rafiat@org.acoblighting.com",
          "u.vanessa@org.acoblighting.com",
          "a.onyekachukwu@org.acoblighting.com",
          "i.surajo@org.acoblighting.com",
        ],
        subject: "New Employee Onboarded: " + pendingUser.first_name + " " + pendingUser.last_name,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Employee Onboarding Notification</title>
    <style>
        body { margin: 0; padding: 0; background: #f3f4f6; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
        .outer-header { background: #000; width: 100%; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }
        .wrapper { max-width: 600px; margin: 20px auto; background: #fff; padding: 32px 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px; }
        .text { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0; }
        .card { margin-top: 22px; border: 1px solid #e5e7eb; overflow: hidden; background: #fbfbfb; border-radius: 6px; }
        .card-header { padding: 12px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #e5e7eb; background: #f8fafc; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 12px 18px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
        tr:last-child td { border-bottom: none; }
        .label { width: 35%; color: #64748b; font-weight: 500; border-right: 1px solid #e5e7eb; }
        .value { color: #0f172a; font-weight: 600; }
        .cta { text-align: center; margin-top: 32px; }
        .button { display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 13px; }
        .footer { background: #000; width: 100%; padding: 40px 0; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }
    </style>
</head>
<body>
    <div class="outer-header">
        <img src="https://erp.acoblighting.com/images/acob-logo-dark.webp" alt="ACOB Lighting" height="35">
    </div>
    <div class="wrapper">
        <div class="title">New Employee Onboarded</div>
        <p class="text">Hello Team,</p>
        <p class="text">This is an automated notification that a new employee has been successfully approved and added to the system.</p>
        
        <div class="card">
            <div class="card-header">Onboarding Details</div>
            <table>
                <tr>
                    <td class="label">Employee Name</td>
                    <td class="value">${pendingUser.first_name} ${pendingUser.last_name}</td>
                </tr>
                <tr>
                    <td class="label">Employee ID</td>
                    <td class="value">${employeeId}</td>
                </tr>
                <tr>
                    <td class="label">Department</td>
                    <td class="value">${pendingUser.department}</td>
                </tr>
                <tr>
                    <td class="label">Official Email</td>
                    <td class="value">${pendingUser.company_email}</td>
                </tr>
                <tr>
                    <td class="label">Work Location</td>
                    <td class="value">
                        ${pendingUser.current_work_location}
                        ${
                          pendingUser.office_location &&
                          pendingUser.office_location !== pendingUser.current_work_location
                            ? `(${pendingUser.office_location})`
                            : ""
                        }
                    </td>
                </tr>
                <tr>
                    <td class="label">Approved Date</td>
                    <td class="value">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</td>
                </tr>
            </table>
        </div>

        <div class="cta">
            <a href="https://erp.acoblighting.com/admin/hr/employees" class="button">View Employee Directory</a>
        </div>
    </div>
    <div class="footer">
        <strong style="color: #fff;">ACOB Lighting Technology Limited</strong><br>
        <span style="color: #16a34a; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">ACOB Internal Systems</span>
        <div style="margin-top: 12px; font-style: italic; font-size: 10px; opacity: 0.7; max-width: 500px; margin-left: auto; margin-right: auto; padding: 0 20px;">
            This is an automated system notification. Please do not reply directly to this email.
        </div>
    </div>
</body>
</html>
`,
      })
    } catch (emailError) {
      console.error("Failed to send notification emails:", emailError)
      // We do NOT rollback here, creation was successful. Just log the error.
    }

    return NextResponse.json({ success: true, employeeId })
  } catch (error: any) {
    console.error("Approval Process Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
