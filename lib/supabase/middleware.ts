import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { canManageMaintenanceMode, parseMaintenanceMode } from "@/lib/maintenance"
import type { EmploymentStatus } from "@/types/database"

// ---------------------------------------------------------------------------
// Maintenance-mode in-memory cache
// Avoids a DB query on every request. TTL: 30 seconds.
// Next.js server processes are long-lived, so this cache persists across
// multiple requests in the same process — exactly what we want.
// ---------------------------------------------------------------------------
let _maintenanceCache: { enabled: boolean; expiresAt: number } | null = null
const MAINTENANCE_CACHE_TTL_MS = 30_000

async function getMaintenanceMode(supabase: ReturnType<typeof createServerClient>): Promise<boolean> {
  const now = Date.now()
  if (_maintenanceCache && now < _maintenanceCache.expiresAt) {
    return _maintenanceCache.enabled
  }

  const { data: settings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .single()

  const { enabled } = parseMaintenanceMode(settings?.value)
  _maintenanceCache = { enabled, expiresAt: now + MAINTENANCE_CACHE_TTL_MS }
  return enabled
}

/**
 * Call this after updating maintenance_mode in system_settings so the
 * in-process cache is immediately invalidated.
 */
export function invalidateMaintenanceCache() {
  _maintenanceCache = null
}

// ---------------------------------------------------------------------------
// Employment status — read from Auth user_metadata (no extra DB query)
// The user_metadata.employment_status field is kept in sync by the
// syncEmploymentStatusToAuth() helper (called from admin role-update routes).
// Fallback: if metadata is missing, we do ONE DB query and then trust the
// session until next refresh.
// ---------------------------------------------------------------------------
function getEmploymentStatusFromUser(user: { user_metadata?: Record<string, unknown> } | null): EmploymentStatus | undefined {
  return user?.user_metadata?.employment_status as EmploymentStatus | undefined
}

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
  const intendedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`

  // Check maintenance mode (cached — at most one DB hit per 30s per process)
  const isMaintenanceMode = await getMaintenanceMode(supabase)

  // If maintenance has been disabled, users should not remain stuck on /maintenance.
  if (!isMaintenanceMode && pathname.startsWith("/maintenance")) {
    const url = request.nextUrl.clone()
    if (!user) {
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    url.pathname = canManageMaintenanceMode(profile?.role) ? "/admin" : "/profile"
    return NextResponse.redirect(url)
  }

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
      // If logged in, check role — reuse the user object's metadata where possible
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, employment_status")
        .eq("id", user.id)
        .single()

      const canBypassMaintenance = canManageMaintenanceMode(profile?.role)

      if (!canBypassMaintenance) {
        const url = request.nextUrl.clone()
        url.pathname = "/maintenance"
        return NextResponse.redirect(url)
      }

      // Employment status — prefer user_metadata (no extra query), fall back to profile
      const status =
        getEmploymentStatusFromUser(user) ??
        (profile?.employment_status as EmploymentStatus | undefined)

      // Allow access to logout and suspension page without status check
      const allowedPaths = ["/auth/logout", "/suspended", "/auth/login"]
      const isAllowedPath = allowedPaths.some((path) => pathname.startsWith(path))

      if (!isAllowedPath) {
        if (status === "suspended") {
          const url = request.nextUrl.clone()
          url.pathname = "/suspended"
          return NextResponse.redirect(url)
        }

        if (status === "separated") {
          const url = request.nextUrl.clone()
          url.pathname = "/auth/login"
          url.searchParams.set("error", "account_separated")
          await supabase.auth.signOut()
          return NextResponse.redirect(url)
        }
      }
    }
  }

  // Allow unauthenticated access to auth pages, public routes, and the form
  if (pathname !== "/" && !user && !pathname.startsWith("/auth") && !pathname.startsWith("/employee/new")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("next", intendedPath || "/profile")
    return NextResponse.redirect(url)
  }

  // Check employment status for authenticated users (Normal flow if maintenance is OFF)
  // Read from user_metadata — zero extra DB queries on the happy path.
  if (user && !isMaintenanceMode) {
    const allowedPaths = ["/auth/logout", "/suspended", "/auth/login"]
    const isAllowedPath = allowedPaths.some((path) => pathname.startsWith(path))

    if (!isAllowedPath) {
      // Try user_metadata first (no DB hit)
      let status = getEmploymentStatusFromUser(user)

      // Fallback: if metadata is missing (legacy users), query the DB once
      if (status === undefined) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("employment_status")
          .eq("id", user.id)
          .single()
        status = profile?.employment_status as EmploymentStatus | undefined
      }

      if (status === "suspended") {
        const url = request.nextUrl.clone()
        url.pathname = "/suspended"
        return NextResponse.redirect(url)
      }

      if (status === "separated") {
        const url = request.nextUrl.clone()
        url.pathname = "/auth/login"
        url.searchParams.set("error", "account_separated")
        await supabase.auth.signOut()
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
