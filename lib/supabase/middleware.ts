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

  // Allow unauthenticated access to auth pages and public routes
  if (pathname !== "/" && !user && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Check employment status for authenticated users
  if (user) {
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
