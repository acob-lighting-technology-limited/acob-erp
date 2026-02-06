import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Allowlist of valid roles
const ALLOWED_ROLES = ["admin", "manager", "employee", "user", "staff", "lead", "visitor"] as const
const SUPER_ADMIN_ROLE = "super_admin"

type AllowedRole = (typeof ALLOWED_ROLES)[number] | typeof SUPER_ADMIN_ROLE

function isValidRole(role: string): role is AllowedRole {
  return role === SUPER_ADMIN_ROLE || ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Verify requester is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (![SUPER_ADMIN_ROLE, "admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // 2. Parse body
    const { email, first_name, last_name, role, department } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // 3. Validate role against allowlist
    const requestedRole = role || "employee"
    if (!isValidRole(requestedRole)) {
      return NextResponse.json({ error: `Invalid role: ${requestedRole}` }, { status: 400 })
    }

    // 4. Only super_admin can assign super_admin role
    if (requestedRole === SUPER_ADMIN_ROLE && profile?.role !== SUPER_ADMIN_ROLE) {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admins can assign the super_admin role" },
        { status: 403 }
      )
    }

    // 5. Create admin client
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 6. Check if user exists with pagination
    let existingUser = null
    let page = 1
    const perPage = 1000

    while (true) {
      const { data: usersPage, error: searchError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })

      if (searchError) {
        console.error("Error listing users:", searchError)
        return NextResponse.json({ error: "Failed to check existing users" }, { status: 500 })
      }

      // Find matching user (case-insensitive)
      const matchedUser = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (matchedUser) {
        existingUser = matchedUser
        break
      }

      // If we got fewer users than perPage, we've reached the end
      if (usersPage.users.length < perPage) {
        break
      }

      page++
    }

    let userId: string

    if (existingUser) {
      // User exists in Auth, just ensure profile is updated
      userId = existingUser.id
    } else {
      // Invite user
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

      if (inviteError) {
        throw inviteError
      }
      userId = inviteData.user.id
    }

    // 7. Create/Update Profile with validated role
    const profilePayload: any = {
      id: userId,
      email,
      role: requestedRole,
      is_active: true,
    }

    if (first_name !== undefined) profilePayload.first_name = first_name
    if (last_name !== undefined) profilePayload.last_name = last_name
    if (department !== undefined) profilePayload.department = department

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(profilePayload)

    if (profileError) {
      throw profileError
    }

    return NextResponse.json({ success: true, userId })
  } catch (error: any) {
    console.error("Invite error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
