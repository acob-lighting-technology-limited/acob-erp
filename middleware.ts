import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow access to root page (shutdown page), API routes, and static assets
  if (
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return await updateSession(request)
  }

  // Check for shutdown bypass cookie
  const bypassCookie = request.cookies.get("shutdown_bypass")

  // If no bypass cookie, redirect to root (shutdown page)
  if (!bypassCookie || bypassCookie.value !== "true") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    // Preserve query parameters (for ?admin=1)
    return NextResponse.redirect(url)
  }

  // If bypass cookie exists, continue with normal flow
  return await updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
