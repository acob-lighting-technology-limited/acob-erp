import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

export const dynamic = "force-dynamic"

// Helper function to create Supabase client
function createClient() {
  const cookieStore = cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

// GET /api/departments - Get all departments
export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    let query = supabase.from("departments").select("*").eq("is_active", true).order("name")

    if (scope) {
      const scopedDepartments = getDepartmentScope(scope, "general")
      if (scopedDepartments) {
        query = scopedDepartments.length > 0 ? query.in("name", scopedDepartments) : query.eq("name", "__none__")
      }
    } else {
      const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
      if (profile?.department) query = query.eq("name", profile.department)
    }

    const { data: departments, error } = await query

    if (error) throw error

    return NextResponse.json({ data: departments })
  } catch (error) {
    console.error("Error fetching departments:", error)
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 })
  }
}

// POST /api/departments - Create a new department (admin/super_admin/hr_global_lead)
export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    const canManageDepartments =
      !!scope && (scope.isAdminLike || (scope.role === "lead" && scope.managedDepartments.includes("Admin & HR")))
    if (!canManageDepartments) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, department_head_id } = body

    if (!name) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    const { data: department, error } = await supabase
      .from("departments")
      .insert({
        name,
        description,
        department_head_id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data: department }, { status: 201 })
  } catch (error) {
    console.error("Error creating department:", error)
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 })
  }
}
