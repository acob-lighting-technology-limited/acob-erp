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

// GET /api/departments/[id] - Get a single department
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)

    const { data: department, error } = await supabase.from("departments").select("*").eq("id", params.id).single()

    if (error) throw error

    if (scope) {
      const scopedDepartments = getDepartmentScope(scope, "general")
      if (scopedDepartments && !scopedDepartments.includes(department.name)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
      if (profile?.department && department.name !== profile.department) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json({ data: department })
  } catch (error) {
    console.error("Error fetching department:", error)
    return NextResponse.json({ error: "Failed to fetch department" }, { status: 500 })
  }
}

// PUT /api/departments/[id] - Update a department (admin/super_admin/hr_global_lead)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
      .update({
        name,
        description,
        department_head_id,
      })
      .eq("id", params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data: department })
  } catch (error) {
    console.error("Error updating department:", error)
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 })
  }
}

// DELETE /api/departments/[id] - Delete a department (admin/super_admin/hr_global_lead)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    const { error } = await supabase.from("departments").delete().eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting department:", error)
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 })
  }
}
