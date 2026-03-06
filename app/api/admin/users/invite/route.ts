import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Allowlist of valid roles
const ALLOWED_ROLES = ["admin", "employee", "visitor", "developer"] as const
const SUPER_ADMIN_ROLE = "super_admin"

type AllowedRole = (typeof ALLOWED_ROLES)[number] | typeof SUPER_ADMIN_ROLE

function isValidRole(role: string): role is AllowedRole {
  return role === SUPER_ADMIN_ROLE || ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])
}

function canAssignRole(assignerRole: string, targetRole: string): boolean {
  if (assignerRole === "developer") return true
  if (assignerRole === "super_admin") return targetRole !== "developer"
  if (assignerRole === "admin") return ["visitor", "employee"].includes(targetRole)
  return false
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

    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileFetchError) {
      console.error("Error fetching requester profile:", profileFetchError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (!["developer", SUPER_ADMIN_ROLE, "admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // 2. Parse body
    const { email: rawEmail, first_name, last_name, role, department } = await request.json()

    if (typeof rawEmail !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    const email = rawEmail.trim()
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    const emailNormalized = email.toLowerCase()

    // 3. Validate role against allowlist
    const roleProvided = role !== undefined
    if (roleProvided && !isValidRole(role)) {
      return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
    }

    // 4. Role assignment guardrails
    if (roleProvided && !canAssignRole(profile?.role || "", role)) {
      return NextResponse.json({ error: "Forbidden: You cannot assign this role" }, { status: 403 })
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
      const matchedUser = usersPage.users.find((u) => u.email?.toLowerCase() === emailNormalized)
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
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(emailNormalized)

      if (inviteError) {
        throw inviteError
      }
      userId = inviteData.user.id
    }

    // 7. Create/Update Profile
    const roleToApply = roleProvided ? role : existingUser ? undefined : "employee"

    if (existingUser && roleToApply) {
      const { data: existingProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).single()

      if (existingProfile?.role === "developer" && profile?.role !== "developer") {
        return NextResponse.json({ error: "Only developer can modify developer accounts" }, { status: 403 })
      }

      if (existingProfile?.role === "developer" && roleToApply !== "developer") {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "developer")

        if ((count || 0) <= 1) {
          return NextResponse.json({ error: "Cannot downgrade the last developer account." }, { status: 400 })
        }
      }
    }

    const profilePayload: any = {
      id: userId,
      company_email: emailNormalized,
      employment_status: "active",
    }

    if (roleToApply) {
      profilePayload.role = roleToApply
      profilePayload.is_admin = ["developer", "super_admin", "admin"].includes(roleToApply)
      // Role changes do NOT affect department lead status
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
