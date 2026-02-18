import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Missing token or password" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Find user by token
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, setup_token_expires_at")
      .eq("setup_token", token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Invalid or expired setup link" }, { status: 400 })
    }

    // 2. Check expiry
    if (!profile.setup_token_expires_at || new Date(profile.setup_token_expires_at) < new Date()) {
      return NextResponse.json({ error: "Setup link has expired. Please contact HR." }, { status: 400 })
    }

    // 3. Update auth user's password
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: password,
      email_confirm: true, // Ensure email is confirmed
    })

    if (authError) {
      return NextResponse.json({ error: `Failed to set password: ${authError.message}` }, { status: 500 })
    }

    // 4. Clear token and reset flag
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        setup_token: null,
        setup_token_expires_at: null,
        must_reset_password: false,
      })
      .eq("id", profile.id)

    if (updateError) {
      console.error("Failed to clear setup token:", updateError)
      // We don't return error here because the password was already updated successfully
    }

    return NextResponse.json({ success: true, message: "Account activated successfully" })
  } catch (error: any) {
    console.error("Setup password error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
