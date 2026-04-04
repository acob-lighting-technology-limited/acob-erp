import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"
import {
  ASSIGNABLE_ROLES,
  canAssignRole,
  canManageDeveloperAccounts,
  canManageSuperAdminAccounts,
} from "@/lib/role-management"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("admin-users-invite")

const SUPER_ADMIN_ROLE = "super_admin"
type AllowedRole = (typeof ASSIGNABLE_ROLES)[number]
type ProfileInvitePayload = {
  id: string
  company_email: string
  employment_status: "active"
  role?: AllowedRole
  first_name?: string
  last_name?: string
  department?: string
}

const InviteUserSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  department: z.string().optional(),
})

export async function PATCH(request: Request) {
  const rl = await rateLimit(`invite:${getClientId(request)}`, { limit: 10, windowSec: 600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

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
      log.error({ err: String(profileFetchError) }, "Error fetching requester profile:")
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (!["developer", SUPER_ADMIN_ROLE, "admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // 2. Parse body
    const body = await request.json()
    const parsed = InviteUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const { email: rawEmail, first_name, last_name, role, department } = parsed.data
    const email = rawEmail.trim()
    const emailNormalized = email.toLowerCase()

    // 3. Validate role against allowlist
    const roleProvided = role !== undefined

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
        log.error({ err: String(searchError) }, "Error listing users:")
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

      if (existingProfile?.role === "developer" && !canManageDeveloperAccounts(profile?.role || "")) {
        return NextResponse.json(
          { error: "Only super admin or developer can modify developer accounts" },
          { status: 403 }
        )
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

      if (existingProfile?.role === "super_admin" && roleToApply !== "super_admin") {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "super_admin")

        if ((count || 0) <= 1) {
          return NextResponse.json({ error: "Cannot downgrade the last super admin account." }, { status: 400 })
        }
      }
    }

    if (roleToApply === "developer" && !canManageDeveloperAccounts(profile?.role || "")) {
      return NextResponse.json({ error: "Only super admin or developer can assign developer role" }, { status: 403 })
    }

    if (roleToApply === "super_admin" && !canManageSuperAdminAccounts(profile?.role || "")) {
      return NextResponse.json({ error: "Only super admin can assign super admin role" }, { status: 403 })
    }

    if (existingUser && existingUser.id === user.id && roleToApply && roleToApply !== profile?.role) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 })
    }

    const profilePayload: ProfileInvitePayload = {
      id: userId,
      company_email: emailNormalized,
      employment_status: "active",
    }

    if (roleToApply) {
      profilePayload.role = roleToApply
      // Role changes do NOT affect department lead status
    }
    if (first_name !== undefined) profilePayload.first_name = first_name
    if (last_name !== undefined) profilePayload.last_name = last_name
    if (department !== undefined) profilePayload.department = department

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(profilePayload)

    if (profileError) {
      throw profileError
    }

    // Audit: user invite/profile creation
    await writeAuditLog(
      supabase,
      {
        action: existingUser ? "update" : "create",
        entityType: "profile",
        entityId: userId,
        context: { actorId: user.id, source: "api" as const },
        newValues: {
          company_email: emailNormalized,
          ...(roleToApply ? { role: roleToApply } : {}),
          ...(department ? { department } : {}),
        },
        metadata: { source: "admin-users-invite", invited: !existingUser },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true, userId })
  } catch (error: unknown) {
    log.error({ err: String(error) }, "Invite error:")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export async function POST(request: Request) {
  return PATCH(request)
}
