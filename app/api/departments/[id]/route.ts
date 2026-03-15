import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"

const log = logger("departments")

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
    log.error({ err: String(error) }, "Error fetching department:")
    return NextResponse.json({ error: "Failed to fetch department" }, { status: 500 })
  }
}

// PUT /api/departments/[id] - Update a department (admin-like only)
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
    const managedDepartments = scope?.managedDepartments || []
    const canManageDepartments = !!scope && (scope.isAdminLike || managedDepartments.includes("Admin & HR"))
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
    log.error({ err: String(error) }, "Error updating department:")
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 })
  }
}

// DELETE /api/departments/[id] - Soft delete a department (admin-like only)
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
    const managedDepartments = scope?.managedDepartments || []
    const canManageDepartments = !!scope && (scope.isAdminLike || managedDepartments.includes("Admin & HR"))
    if (!canManageDepartments) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: existingDepartment, error: fetchDepartmentError } = await supabase
      .from("departments")
      .select("id, name, is_active")
      .eq("id", params.id)
      .single()

    if (fetchDepartmentError || !existingDepartment) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    const { count: assignedProfilesCount, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("department", existingDepartment.name)

    if (countError) throw countError
    if ((assignedProfilesCount || 0) > 0) {
      return NextResponse.json(
        { error: "Cannot deactivate department while users are assigned to it" },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from("departments")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ success: true, soft_deleted: true })
  } catch (error) {
    log.error({ err: String(error) }, "Error soft deleting department:")
    return NextResponse.json({ error: "Failed to deactivate department" }, { status: 500 })
  }
}
