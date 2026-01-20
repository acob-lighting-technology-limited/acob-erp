import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, otherNames, email, department, companyRole, phoneNumber, role } = body

    // Validate required fields (department is optional for executives like MD)
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        {
          success: false,
          error: "First name, last name, and email are required",
        },
        { status: 400 }
      )
    }

    // Validate email format
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

    // Check if user already exists
    const { data: existingUser } = await serviceSupabase.auth.admin.listUsers()
    const userExists = existingUser.users.some((u) => u.email === email)

    if (userExists) {
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
        role: role || "staff",
        is_admin: ["super_admin", "admin"].includes(role || "staff"),
        is_department_lead: role === "lead",
        lead_departments: role === "lead" ? [department] : [],
        employment_status: "active", // Explicitly set employment status
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
        { status: 400 }
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
