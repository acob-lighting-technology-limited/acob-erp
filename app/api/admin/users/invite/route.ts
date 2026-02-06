import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

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
    if (!["super_admin", "admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // 2. Parse body
    const { email, first_name, last_name, role, department } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // 3. Create admin client
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

    // 4. Update profile if user exists, else invite
    // Check if user exists in Auth
    const { data: existingUsers, error: searchError } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

    let userId

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

    // 5. Create/Update Profile
    // We update the profile using the admin client to bypass "update own profile" RLS if needed,
    // or just to ensure it works even if the user hasn't accepted invite yet.
    // However, our profiles table might have RLS that admin can write to.
    // Let's use `supabase` (authed admin) if RLS allows, otherwise `supabaseAdmin`.
    // We already established admin can write to profiles.

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      first_name,
      last_name,
      role: role || "employee",
      department,
      is_active: true,
    })

    if (profileError) {
      throw profileError
    }

    return NextResponse.json({ success: true, userId })
  } catch (error: any) {
    console.error("Invite error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
