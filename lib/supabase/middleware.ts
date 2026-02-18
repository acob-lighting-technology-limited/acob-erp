import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { EmploymentStatus } from "@/types/database"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Allow unauthenticated access to auth pages, public routes, and the form
  if (pathname !== "/" && !user && !pathname.startsWith("/auth") && !pathname.startsWith("/employee/new")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Check maintenance mode
  const { data: settings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .single()

  const isMaintenanceMode = settings?.value?.enabled || false

  // If maintenance is on, and not already on maintenance page or statics
  if (
    isMaintenanceMode &&
    !pathname.startsWith("/maintenance") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/favicon.ico")
  ) {
    if (!user) {
      // If not logged in, allow auth pages, otherwise maintenance
      if (!pathname.startsWith("/auth")) {
        const url = request.nextUrl.clone()
        url.pathname = "/maintenance"
        return NextResponse.redirect(url)
      }
    } else {
      // If logged in, check role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, employment_status")
        .eq("id", user.id)
        .single()

      const isAdmin = ["super_admin", "admin"].includes(profile?.role || "")

      if (!isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = "/maintenance"
        return NextResponse.redirect(url)
      }

      // Reuse profile for employment status check
      const status = profile?.employment_status as EmploymentStatus | undefined

      // Allow access to logout and suspension page without status check
      const allowedPaths = ["/auth/logout", "/suspended", "/auth/login"]
      const isAllowedPath = allowedPaths.some((path) => pathname.startsWith(path))

      if (!isAllowedPath) {
        // Handle suspended employees - redirect to suspension notice page
        if (status === "suspended") {
          const url = request.nextUrl.clone()
          url.pathname = "/suspended"
          return NextResponse.redirect(url)
        }

        // Handle terminated employees - sign out and redirect to login with error
        if (status === "terminated") {
          // Clear session cookies and redirect to login
          const url = request.nextUrl.clone()
          url.pathname = "/auth/login"
          url.searchParams.set("error", "account_terminated")

          // Sign out the user
          await supabase.auth.signOut()

          return NextResponse.redirect(url)
        }
      }

      // If we are here, maintenance is on but user is admin, or maintenance is off (but we are inside isMaintenanceMode block? No wait)
      // Logic correction needed below
    }
  }

  // Check employment status for authenticated users (Normal flow if maintenance is OFF)
  if (user && !isMaintenanceMode) {
    // Allow access to logout and suspension page without status check
    const allowedPaths = ["/auth/logout", "/suspended", "/auth/login"]
    const isAllowedPath = allowedPaths.some((path) => pathname.startsWith(path))

    if (!isAllowedPath) {
      // Fetch employment status from profile
      const { data: profile } = await supabase.from("profiles").select("employment_status").eq("id", user.id).single()

      const status = profile?.employment_status as EmploymentStatus | undefined

      // Handle suspended employees - redirect to suspension notice page
      if (status === "suspended") {
        const url = request.nextUrl.clone()
        url.pathname = "/suspended"
        return NextResponse.redirect(url)
      }

      // Handle terminated employees - sign out and redirect to login with error
      if (status === "terminated") {
        // Clear session cookies and redirect to login
        const url = request.nextUrl.clone()
        url.pathname = "/auth/login"
        url.searchParams.set("error", "account_terminated")

        // Sign out the user
        await supabase.auth.signOut()

        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
