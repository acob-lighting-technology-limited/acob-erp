import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { formValidation } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  // First, verify the caller is authenticated and has user-management privileges
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  const canManageUsers =
    !!scope && (scope.isAdminLike || (scope.role === "lead" && scope.managedDepartments.includes("Admin & HR")))
  if (!canManageUsers) {
    return NextResponse.json({ success: false, error: "Forbidden: Insufficient privileges" }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required Supabase configuration")
    return NextResponse.json({ success: false, error: "Configuration error: Missing configuration" }, { status: 500 })
  }

  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    const body = await request.json()
    const { firstName, lastName, otherNames, email, department, companyRole, phoneNumber, role, employeeNumber } = body

    // Validate role if provided
    const allowedRoles = ["employee", "lead", "admin", "super_admin"]
    if (role && !allowedRoles.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid role. Allowed values: ${allowedRoles.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Validate required fields (department is optional for executives like MD)
    if (!firstName || !lastName || !email || !employeeNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "First name, last name, email, and employee number are required",
        },
        { status: 400 }
      )
    }

    // Validate employee number format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)
    const empNumPattern = /^ACOB\/[0-9]{4}\/[0-9]{3}$/
    if (!empNumPattern.test(employeeNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee number must be in format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)",
        },
        { status: 400 }
      )
    }

    // Validate email format and domain
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email format",
        },
        { status: 400 }
      )
    }

    if (!formValidation.isCompanyEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Only @acoblighting.com and @org.acoblighting.com emails are allowed.",
        },
        { status: 400 }
      )
    }

    // Check if user already exists using the profile table (more direct)
    const { data: existingProfile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("company_email", email)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        {
          success: false,
          error: "A user with this email already exists",
        },
        { status: 409 }
      )
    }

    // Create auth user without password - they will use OTP login
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      email_confirm: false, // User will verify via OTP when they login
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        other_names: otherNames || "",
        department: department,
        phone_number: phoneNumber || "",
      },
    })

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          error: authError.message,
        },
        { status: 400 }
      )
    }

    // Update profile with all details
    const { error: profileError } = await serviceSupabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        other_names: otherNames || null,
        company_email: email,
        department: department,
        company_role: companyRole || null,
        phone_number: phoneNumber || null,
        role: role || "employee",
        is_admin: ["super_admin", "admin"].includes(role || "employee"),
        is_department_lead: role === "lead",
        lead_departments: role === "lead" ? [department] : [],
        employment_status: "active", // Explicitly set employment status
        employee_number: employeeNumber || null, // Employee number (ACOB/YEAR/NUMBER)
      })
      .eq("id", authData.user.id)

    if (profileError) {
      console.error("[Create User] Profile update error:", profileError)
      // If profile update fails, try to delete the auth user
      await serviceSupabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        {
          success: false,
          error: `Database error: ${profileError.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully. They can now login with their email and receive an OTP.",
        userId: authData.user.id,
        email: authData.user.email,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[v0] Create user failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
