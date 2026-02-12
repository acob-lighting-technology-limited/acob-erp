import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Handles confirmation links from Supabase emails (invite, recovery, email confirmation).
 * Exchanges token_hash for a session, then redirects to the appropriate page.
 *
 * Query params:
 * - token_hash: The token hash from the email link
 * - type: The type of confirmation (invite, recovery, email, signup)
 * - next: Optional redirect path after confirmation (defaults to /dashboard)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as "invite" | "recovery" | "email" | "signup" | null
  const next = searchParams.get("next") || "/dashboard"

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/auth/error?message=Missing+confirmation+parameters", request.url))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type === "email" ? "email" : type === "invite" ? "invite" : type === "recovery" ? "recovery" : "signup",
  })

  if (error) {
    console.error("Confirm error:", error.message)
    return NextResponse.redirect(new URL(`/auth/error?message=${encodeURIComponent(error.message)}`, request.url))
  }

  // For invites, redirect to set-password page
  if (type === "invite") {
    return NextResponse.redirect(new URL("/auth/set-password", request.url))
  }

  // For recovery, redirect to reset-password page
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/reset-password", request.url))
  }

  // For all other types, redirect to the `next` path
  return NextResponse.redirect(new URL(next, request.url))
}
