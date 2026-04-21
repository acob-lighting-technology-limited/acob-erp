import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ADMIN_SCOPE_MODE_COOKIE, resolveAdminScope } from "@/lib/admin/rbac"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("next", "/lead")
    return NextResponse.redirect(loginUrl)
  }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) {
    return NextResponse.redirect(new URL("/profile", request.url))
  }

  // Only users with lead identity should enter lead context.
  if (!scope.isDepartmentLead) {
    return NextResponse.redirect(new URL("/admin", request.url))
  }

  const response = NextResponse.redirect(new URL("/admin", request.url))
  response.cookies.set(ADMIN_SCOPE_MODE_COOKIE, "lead", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })

  return response
}
