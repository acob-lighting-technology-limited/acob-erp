import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") || "/dashboard"

  // Validate and sanitize 'next' to prevent open redirects
  let safeNext = "/dashboard"
  if (
    next &&
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes(":") && // Prevent scheme/host characters
    !/https?:\/\//i.test(next) // Extra check for explicit http/https
  ) {
    safeNext = next
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("Callback error:", error.message)
      return NextResponse.redirect(new URL(`/auth/error?message=${encodeURIComponent(error.message)}`, request.url))
    }
  }

  return NextResponse.redirect(new URL(safeNext, request.url))
}
