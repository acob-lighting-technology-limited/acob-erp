import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow shutdown-access API without any checks (needs to work when logged out)
  if (pathname === "/api/shutdown-access") {
    return NextResponse.next()
  }

  // Allow other API routes and static assets through with session update
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return await updateSession(request)
  }

  // Check system status from database
  let isShutdownEnabled = false
  let isMaintenanceEnabled = false

  try {
    const supabase = await createClient()
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["shutdown_mode", "maintenance_mode"])

    // If table doesn't exist or query fails, allow normal access
    if (!error && settings) {
      const shutdownMode = settings?.find(s => s.setting_key === "shutdown_mode")?.setting_value as any
      const maintenanceMode = settings?.find(s => s.setting_key === "maintenance_mode")?.setting_value as any

      isShutdownEnabled = shutdownMode?.enabled === true
      isMaintenanceEnabled = maintenanceMode?.enabled === true
    }
  } catch (error) {
    // If there's any error (e.g., table doesn't exist), allow normal access
    console.error("Error checking system settings:", error)
  }

  // If neither mode is enabled, continue with normal flow
  if (!isShutdownEnabled && !isMaintenanceEnabled) {
    return await updateSession(request)
  }

  // Allow access to root page (status page)
  if (pathname === "/") {
    return await updateSession(request)
  }

  // Check for shutdown bypass cookie
  const bypassCookie = request.cookies.get("shutdown_bypass")

  // If no bypass cookie, redirect to root (status page)
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
