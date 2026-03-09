import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { canAccessAdminSection, resolveAdminScope } from "@/lib/admin/rbac"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope || !canAccessAdminSection(scope, "hr")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const employeeId = String(params?.id || "").trim()
    if (!employeeId) {
      return NextResponse.json({ error: "Employee id is required" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase as any)

    const { data: profile, error: profileError } = await dataClient
      .from("profiles")
      .select("*")
      .eq("id", employeeId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // Department-lead actors can only read people within their managed scope.
    if (!scope.isAdminLike) {
      const inDepartmentScope =
        scope.managedDepartments.length === 0 ||
        (profile.department && scope.managedDepartments.includes(profile.department))
      const inOfficeScope =
        scope.managedOffices.length === 0 ||
        (profile.office_location && scope.managedOffices.includes(profile.office_location))

      if (!inDepartmentScope && !inOfficeScope) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const [tasksResult, assignmentsResult, deptAssetsResult, officeAssetsResult, docsResult] = await Promise.all([
      dataClient
        .from("tasks")
        .select("id, title, status, created_at")
        .eq("assigned_to", employeeId)
        .order("created_at", { ascending: false })
        .limit(10),
      dataClient
        .from("asset_assignments")
        .select("id, asset_id, assigned_at, is_current, assignment_type")
        .eq("assigned_to", employeeId)
        .eq("is_current", true)
        .limit(10),
      profile.department
        ? dataClient
            .from("assets")
            .select(
              "id, asset_name, asset_type, asset_model, serial_number, unique_code, status, assignment_type, department, created_at"
            )
            .eq("assignment_type", "department")
            .eq("department", profile.department)
            .eq("status", "assigned")
            .is("deleted_at", null)
            .limit(10)
        : Promise.resolve({ data: [] as any[] }),
      profile.office_location
        ? dataClient
            .from("assets")
            .select(
              "id, asset_name, asset_type, asset_model, serial_number, unique_code, status, assignment_type, office_location, created_at"
            )
            .eq("assignment_type", "office")
            .eq("office_location", profile.office_location)
            .eq("status", "assigned")
            .is("deleted_at", null)
            .limit(10)
        : Promise.resolve({ data: [] as any[] }),
      dataClient
        .from("user_documentation")
        .select("id, title, created_at")
        .eq("user_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(10),
    ])

    const assignedAssetIds = Array.from(
      new Set((assignmentsResult.data || []).map((row: any) => row.asset_id).filter(Boolean))
    )

    let assetMap = new Map<string, any>()
    if (assignedAssetIds.length > 0) {
      const { data: assetRows } = await dataClient
        .from("assets")
        .select("id, asset_name, asset_type, asset_model, serial_number, unique_code, status")
        .in("id", assignedAssetIds)
        .is("deleted_at", null)

      assetMap = new Map((assetRows || []).map((row: any) => [row.id, row]))
    }

    const individualAssets = (assignmentsResult.data || []).map((assignment: any) => ({
      ...assignment,
      Asset: assetMap.get(assignment.asset_id) || null,
      assignmentType: "individual",
    }))

    const departmentAssets = (deptAssetsResult.data || []).map((asset: any) => ({
      id: `dept-${asset.id}`,
      asset_id: asset.id,
      assigned_at: asset.created_at,
      is_current: true,
      assignment_type: "department",
      Asset: asset,
      assignmentType: "department",
      department: asset.department,
    }))

    const officeAssets = (officeAssetsResult.data || []).map((asset: any) => ({
      id: `office-${asset.id}`,
      asset_id: asset.id,
      assigned_at: asset.created_at,
      is_current: true,
      assignment_type: "office",
      Asset: asset,
      assignmentType: "office",
      officeLocation: asset.office_location || profile.office_location,
    }))

    return NextResponse.json({
      profile,
      related: {
        tasks: tasksResult.data || [],
        assets: [...individualAssets, ...departmentAssets, ...officeAssets],
        documentation: docsResult.data || [],
      },
    })
  } catch (error: any) {
    const message = error?.message || "Failed to load employee overview"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
